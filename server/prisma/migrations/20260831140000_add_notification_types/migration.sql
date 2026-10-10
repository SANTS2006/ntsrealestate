-- New NotificationType values for events not previously wired up:
-- inspection_scheduled (the notify() call in inspection.service.js was
-- already using this value, but it wasn't a valid enum member, so every
-- call silently failed and was swallowed by its try/catch), plus
-- lease_activated, invoice_sent, audit_remark_created, and tenant_message
-- for the notification events added in this migration's release.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'inspection_scheduled';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'lease_activated';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'invoice_sent';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'audit_remark_created';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'tenant_message';
