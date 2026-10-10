import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/authorize.js';
import { csrfProtection } from '../../middleware/csrf.js';
import { validate } from '../../middleware/validate.js';
import * as inspectionController from '../../controllers/inspection.controller.js';
import {
  listInspectionsSchema, inspectionIdParamSchema, scheduleInspectionSchema, updateInspectionSchema, completeInspectionSchema,
} from '../../validators/inspection.validators.js';

export const inspectionsRouter = Router();

inspectionsRouter.use(authenticate);

inspectionsRouter.get('/', requirePermission('inspections:read'), validate(listInspectionsSchema), inspectionController.list);
inspectionsRouter.get('/:id', requirePermission('inspections:read'), validate(inspectionIdParamSchema), inspectionController.get);
inspectionsRouter.post('/', csrfProtection, requirePermission('inspections:create'), validate(scheduleInspectionSchema), inspectionController.schedule);
inspectionsRouter.patch('/:id', csrfProtection, requirePermission('inspections:update'), validate(updateInspectionSchema), inspectionController.update);
inspectionsRouter.post('/:id/complete', csrfProtection, requirePermission('inspections:update'), validate(completeInspectionSchema), inspectionController.complete);
inspectionsRouter.post('/:id/cancel', csrfProtection, requirePermission('inspections:update'), validate(inspectionIdParamSchema), inspectionController.cancel);
