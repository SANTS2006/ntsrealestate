import { prisma } from '../config/database.js';

// Audit logs are append-only by design — this repository deliberately
// exposes no update/delete function. See docs/security/security-architecture.md.
export function createAuditLog(entry, tx = prisma) {
  return tx.auditLog.create({ data: entry });
}

function buildAuditLogWhere(organizationId, { action, entityType, userId, from, to }) {
  return {
    organizationId,
    ...(action ? { action: { contains: action } } : {}),
    ...(entityType ? { entityType } : {}),
    ...(userId ? { userId } : {}),
    ...(from || to ? { timestamp: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
  };
}

export function findAuditLogsByOrganization(organizationId, { skip, take, action, entityType, userId, from, to }) {
  return prisma.auditLog.findMany({
    where: buildAuditLogWhere(organizationId, { action, entityType, userId, from, to }),
    include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
    orderBy: { timestamp: 'desc' },
    skip,
    take,
  });
}

export function countAuditLogsByOrganization(organizationId, { action, entityType, userId, from, to }) {
  return prisma.auditLog.count({ where: buildAuditLogWhere(organizationId, { action, entityType, userId, from, to }) });
}
