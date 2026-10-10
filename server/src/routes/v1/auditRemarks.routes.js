import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/authorize.js';
import { csrfProtection } from '../../middleware/csrf.js';
import { validate } from '../../middleware/validate.js';
import * as auditRemarkController from '../../controllers/auditRemark.controller.js';
import { listAuditRemarksSchema, createAuditRemarkSchema } from '../../validators/auditRemark.validators.js';

export const auditRemarksRouter = Router();

auditRemarksRouter.use(authenticate);
auditRemarksRouter.get('/', requirePermission('audit-remarks:read'), validate(listAuditRemarksSchema), auditRemarkController.list);
auditRemarksRouter.post('/', csrfProtection, requirePermission('audit-remarks:create'), validate(createAuditRemarkSchema), auditRemarkController.create);
