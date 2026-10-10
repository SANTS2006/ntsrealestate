import { prisma } from '../config/database.js';
import { logger } from '../config/logger.js';
import { buildPaginationMeta } from '../utils/pagination.js';

// Records what a platform admin did. Like the tenant audit service it never
// blocks or fails the action being recorded — a logging failure is logged
// and swallowed. `actor` is { id, firstName, lastName, email }.
export async function platformAudit({ actor, action, targetType, targetId, targetLabel, details, req }) {
  try {
    await prisma.platformAuditLog.create({
      data: {
        actorId: actor?.id ?? null,
        actorName: actor ? `${actor.firstName ?? ''} ${actor.lastName ?? ''}`.trim() || actor.email : 'Unknown',
        actorEmail: actor?.email ?? 'unknown',
        action,
        targetType: targetType ?? null,
        targetId: targetId ?? null,
        targetLabel: targetLabel ?? null,
        details: details ?? undefined,
        ipAddress: req?.ip ?? null,
      },
    });
  } catch (err) {
    logger.error({ err, action }, 'failed to write platform audit log');
  }
}

export async function listPlatformAuditLogs({ page, pageSize, skip, take, action, search }) {
  const where = {
    ...(action ? { action } : {}),
    ...(search
      ? {
          OR: [
            { actorName: { contains: search, mode: 'insensitive' } },
            { actorEmail: { contains: search, mode: 'insensitive' } },
            { targetLabel: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
  const [logs, total, actions] = await Promise.all([
    prisma.platformAuditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
    prisma.platformAuditLog.count({ where }),
    prisma.platformAuditLog.findMany({ distinct: ['action'], select: { action: true }, orderBy: { action: 'asc' } }),
  ]);
  return { logs, actions: actions.map((a) => a.action), meta: buildPaginationMeta({ page, pageSize, total }) };
}
