import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as auditLogController from '../../controllers/auditLog.controller.js';
import { listAuditLogsSchema } from '../../validators/auditLog.validators.js';

export const auditLogsRouter = Router();

auditLogsRouter.use(authenticate);
auditLogsRouter.get('/', requirePermission('audit-logs:read'), validate(listAuditLogsSchema), auditLogController.list);
