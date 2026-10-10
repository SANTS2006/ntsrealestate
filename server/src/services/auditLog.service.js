import { buildPaginationMeta } from '../utils/pagination.js';
import { findAuditLogsByOrganization, countAuditLogsByOrganization } from '../repositories/auditLog.repository.js';

function serializeAuditLog(entry) {
  return {
    id: entry.id,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    oldValues: entry.oldValues,
    newValues: entry.newValues,
    ipAddress: entry.ipAddress,
    timestamp: entry.timestamp,
    user: entry.user ? { id: entry.user.id, firstName: entry.user.firstName, lastName: entry.user.lastName, email: entry.user.email } : null,
  };
}

// Gated behind `audit-logs:read`, which only `administrator` and `auditor`
// hold by default (see constants/permissions.js) — every other role has no
// route to this at all. No resource-level scoping is applied on top since
// the audit trail is inherently an organization-wide, admin/auditor-only
// view, not a property-hierarchy resource.
export async function listAuditLogs(organizationId, { page, pageSize, skip, take, action, entityType, userId, from, to }) {
  const [entries, total] = await Promise.all([
    findAuditLogsByOrganization(organizationId, { skip, take, action, entityType, userId, from, to }),
    countAuditLogsByOrganization(organizationId, { action, entityType, userId, from, to }),
  ]);
  return { entries: entries.map(serializeAuditLog), meta: buildPaginationMeta({ page, pageSize, total }) };
}
