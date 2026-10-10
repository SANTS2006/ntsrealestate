import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/authorize.js';
import { csrfProtection } from '../../middleware/csrf.js';
import { validate } from '../../middleware/validate.js';
import * as maintenanceController from '../../controllers/maintenanceRequest.controller.js';
import * as workOrderController from '../../controllers/workOrder.controller.js';
import {
  listMaintenanceRequestsSchema, maintenanceRequestIdParamSchema, createMaintenanceRequestSchema, assignMaintenanceRequestSchema,
} from '../../validators/maintenanceRequest.validators.js';
import { maintenanceRequestIdParamSchema as workOrderParentParamSchema, createWorkOrderSchema } from '../../validators/workOrder.validators.js';

export const maintenanceRouter = Router();

maintenanceRouter.use(authenticate);

maintenanceRouter.get('/', requirePermission('maintenance:read'), validate(listMaintenanceRequestsSchema), maintenanceController.list);
maintenanceRouter.get('/:id', requirePermission('maintenance:read'), validate(maintenanceRequestIdParamSchema), maintenanceController.get);
maintenanceRouter.post('/', csrfProtection, requirePermission('maintenance:create'), validate(createMaintenanceRequestSchema), maintenanceController.create);
maintenanceRouter.delete('/:id', csrfProtection, requirePermission('maintenance:delete'), validate(maintenanceRequestIdParamSchema), maintenanceController.remove);
maintenanceRouter.post('/:id/review', csrfProtection, requirePermission('maintenance:update'), validate(maintenanceRequestIdParamSchema), maintenanceController.review);
maintenanceRouter.get('/:id/vendors', requirePermission('maintenance:update'), validate(maintenanceRequestIdParamSchema), maintenanceController.vendorsForRequest);
maintenanceRouter.post('/:id/assign', csrfProtection, requirePermission('maintenance:update'), validate(assignMaintenanceRequestSchema), maintenanceController.assign);
maintenanceRouter.post('/:id/cancel', csrfProtection, requirePermission('maintenance:update'), validate(maintenanceRequestIdParamSchema), maintenanceController.cancel);

// Work orders are always created under a specific maintenance request.
maintenanceRouter.get('/:maintenanceRequestId/work-orders', requirePermission('work-orders:read'), validate(workOrderParentParamSchema), workOrderController.listForMaintenanceRequest);
maintenanceRouter.post('/:maintenanceRequestId/work-orders', csrfProtection, requirePermission('work-orders:create'), validate(createWorkOrderSchema), workOrderController.create);
