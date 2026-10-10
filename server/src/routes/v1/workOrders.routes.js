import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/authorize.js';
import { csrfProtection } from '../../middleware/csrf.js';
import { validate } from '../../middleware/validate.js';
import * as workOrderController from '../../controllers/workOrder.controller.js';
import {
  listWorkOrdersSchema, workOrderIdParamSchema, updateWorkOrderSchema, completeWorkOrderSchema,
} from '../../validators/workOrder.validators.js';

// Standalone-by-id work order routes — creation/listing-by-parent live under
// /maintenance/:maintenanceRequestId/work-orders (see maintenance.routes.js).
export const workOrdersRouter = Router();

workOrdersRouter.use(authenticate);

workOrdersRouter.get('/', requirePermission('work-orders:read'), validate(listWorkOrdersSchema), workOrderController.list);
workOrdersRouter.get('/:id', requirePermission('work-orders:read'), validate(workOrderIdParamSchema), workOrderController.get);
workOrdersRouter.patch('/:id', csrfProtection, requirePermission('work-orders:update'), validate(updateWorkOrderSchema), workOrderController.update);
workOrdersRouter.delete('/:id', csrfProtection, requirePermission('work-orders:delete'), validate(workOrderIdParamSchema), workOrderController.remove);
workOrdersRouter.post('/:id/start', csrfProtection, requirePermission('work-orders:update'), validate(workOrderIdParamSchema), workOrderController.start);
workOrdersRouter.post('/:id/complete', csrfProtection, requirePermission('work-orders:update'), validate(completeWorkOrderSchema), workOrderController.complete);
workOrdersRouter.post('/:id/cancel', csrfProtection, requirePermission('work-orders:update'), validate(workOrderIdParamSchema), workOrderController.cancel);
