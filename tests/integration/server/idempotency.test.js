import { describe, it, expect, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { idempotency } from '../../../server/src/middleware/idempotency.js';
import { prisma } from '../../../server/src/config/database.js';

// Drives the middleware directly with a fake request/response so the real
// unique index in the real database is what arbitrates.

const userId = randomUUID();
afterAll(async () => { await prisma.idempotencyKey.deleteMany({ where: { scope: `user:${userId}` } }); }, 30_000);

function call({ key, body = { amount: 100 }, status = 201, handler }) {
  return new Promise((resolve) => {
    const req = { method: 'POST', originalUrl: '/api/v1/payments', headers: { 'idempotency-key': key, 'content-type': 'application/json' }, body, session: { userId }, id: 'req-1' };
    const res = {
      statusCode: 200, headers: {},
      setHeader(k, v) { this.headers[k] = v; },
      status(c) { this.statusCode = c; return this; },
      json(b) { resolve({ status: this.statusCode, body: b, replayed: this.headers['Idempotent-Replayed'] === 'true' }); return this; },
      on() {},
    };
    idempotency(req, res, async () => {
      await handler?.(); // the real route runs here
      res.status(status).json({ success: true, data: { n: randomUUID() } });
    });
  });
}

describe('idempotency', () => {
  it('runs the work once and replays the first answer for a repeat', async () => {
    let runs = 0;
    const handler = async () => { runs += 1; };
    const first = await call({ key: 'key-aaaaaaaa-1', handler });
    const second = await call({ key: 'key-aaaaaaaa-1', handler });
    expect(runs).toBe(1);
    expect(second.replayed).toBe(true);
    expect(second.status).toBe(201);
    expect(second.body).toEqual(first.body);
  }, 30_000);

  it('lets only one of many simultaneous identical requests do the work', async () => {
    let runs = 0;
    const handler = async () => { runs += 1; await new Promise((r) => setTimeout(r, 400)); };
    const results = await Promise.all(Array.from({ length: 8 }, () => call({ key: 'key-bbbbbbbb-2', handler })));
    expect(runs).toBe(1);
    // Every duplicate is either told "already being processed" (409) or, if the first
    // finished meanwhile, handed the first answer (replayed 201). Never a second execution.
    expect(results.every((r) => r.status === 409 || (r.status === 201 && r.body))).toBe(true);
    expect(results.filter((r) => r.status === 201 && !r.replayed)).toHaveLength(1);
  }, 30_000);

  it('rejects the same key reused for a different request', async () => {
    await call({ key: 'key-cccccccc-3', body: { amount: 1 } });
    const other = await call({ key: 'key-cccccccc-3', body: { amount: 2 } });
    expect(other.status).toBe(422);
    expect(other.body.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
  }, 30_000);

  it('forgets a failed attempt so a corrected retry can go through', async () => {
    let runs = 0;
    const handler = async () => { runs += 1; };
    const failed = await call({ key: 'key-dddddddd-4', status: 422, handler });
    expect(failed.status).toBe(422);
    await new Promise((r) => setTimeout(r, 1500)); // the delete is fire-and-forget
    const retry = await call({ key: 'key-dddddddd-4', status: 201, handler });
    expect(retry.status).toBe(201);
    expect(runs).toBe(2);
  }, 30_000);

  it('does nothing without the header, so existing clients are unaffected', async () => {
    let runs = 0;
    const a = await call({ key: undefined, handler: async () => { runs += 1; } });
    const b = await call({ key: undefined, handler: async () => { runs += 1; } });
    expect(runs).toBe(2);
    expect(a.replayed || b.replayed).toBe(false);
  }, 30_000);
});
