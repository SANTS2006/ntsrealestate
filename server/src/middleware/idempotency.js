import { createHash } from 'node:crypto';
import { prisma } from '../config/database.js';
import { logger } from '../config/logger.js';

// Repeating a write must not repeat its effect. A browser that double-clicks,
// or retries after a timeout, sends the same Idempotency-Key; the first
// request does the work and every repeat gets that first response back.
//
// Only requests that carry the header are touched, so existing clients keep
// working unchanged. The (scope, key) pair is unique in the database, so two
// copies arriving at the same instant — even on different server instances —
// cannot both run: one inserts the row, the other sees it.

const KEY_PATTERN = /^[A-Za-z0-9_.:-]{8,128}$/;
const METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function hashRequest(req) {
  return createHash('sha256').update(`${req.method}|${req.originalUrl.split('?')[0]}|${JSON.stringify(req.body ?? {})}`).digest('hex');
}

export async function idempotency(req, res, next) {
  try {
    const key = req.headers['idempotency-key'];
    if (!key || !METHODS.has(req.method)) return next();
    if (!KEY_PATTERN.test(key) || (req.headers['content-type'] ?? '').startsWith('multipart/')) return next();
    const who = req.session?.userId ?? req.session?.platformAdminId;
    if (!who) return next(); // anonymous requests (login, register) are rate-limited instead
    const scope = `${req.session?.userId ? 'user' : 'admin'}:${who}`;
    const requestHash = hashRequest(req);

    let record;
    try {
      record = await prisma.idempotencyKey.create({ data: { key, scope, method: req.method, path: req.originalUrl.split('?')[0], requestHash } });
    } catch (err) {
      if (err?.code !== 'P2002') throw err;
      const existing = await prisma.idempotencyKey.findUnique({ where: { scope_key: { scope, key } } });
      if (!existing) return next();
      if (existing.requestHash !== requestHash) {
        return res.status(422).json({ success: false, error: { code: 'IDEMPOTENCY_KEY_REUSED', message: 'That Idempotency-Key was already used for a different request.' }, requestId: req.id });
      }
      if (existing.completedAt) {
        res.setHeader('Idempotent-Replayed', 'true');
        return res.status(existing.statusCode ?? 200).json(existing.responseBody);
      }
      return res.status(409).json({ success: false, error: { code: 'REQUEST_IN_PROGRESS', message: 'This request is already being processed.' }, requestId: req.id });
    }

    // Remember the outcome. Only successful outcomes are kept; a failed attempt is forgotten so a corrected retry can go through.
    const json = res.json.bind(res);
    let settled = false;
    // Responses that never go through res.json (204s, downloads) or die early: forget the key.
    res.on('close', () => { if (!settled) prisma.idempotencyKey.delete({ where: { id: record.id } }).catch(() => {}); });
    res.json = (body) => {
      settled = true;
      const status = res.statusCode;
      const done = status >= 300
        ? prisma.idempotencyKey.delete({ where: { id: record.id } })
        : prisma.idempotencyKey.update({ where: { id: record.id }, data: { statusCode: status, responseBody: body ?? null, completedAt: new Date() } });
      done.catch((err) => logger.warn({ err }, 'could not store idempotent response'));
      return json(body);
    };
    return next();
  } catch (err) {
    return next(err);
  }
}

export function purgeOldIdempotencyKeys() {
  return prisma.idempotencyKey.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 24 * 3600 * 1000) } } });
}
