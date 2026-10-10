import { createAuditLog } from '../repositories/auditLog.repository.js';
import { logger } from '../config/logger.js';

// Called from services (never controllers directly) after every mutating
// action worth an audit trail — see the action list in
// docs/security/security-architecture.md. Never receives passwords, tokens,
// or secrets in oldValues/newValues; callers are responsible for passing
// only the safe, already-redacted fields worth recording.
export async function audit({ organizationId = null, userId = null, action, entityType, entityId = null, oldValues, newValues, req, tx }) {
  try {
    await createAuditLog(
      {
        organizationId,
        userId,
        action,
        entityType,
        entityId,
        oldValues,
        newValues,
        ipAddress: req?.ip,
        userAgent: req?.headers?.['user-agent'],
      },
      tx
    );
  } catch (err) {
    // Audit logging must never take down the primary operation — log the
    // failure loudly instead so it's visible in monitoring, and continue.
    logger.error({ err, action, entityType }, 'failed to write audit log');
  }
}
