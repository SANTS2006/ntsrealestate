import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/authorize.js';
import { csrfProtection } from '../../middleware/csrf.js';
import { validate } from '../../middleware/validate.js';
import * as leaseController from '../../controllers/lease.controller.js';
import {
  listLeasesSchema, leaseIdParamSchema, createLeaseSchema, updateLeaseSchema,
  terminateLeaseSchema, renewLeaseSchema,
} from '../../validators/lease.validators.js';

export const leasesRouter = Router();

leasesRouter.use(authenticate);

leasesRouter.get('/', requirePermission('leases:read'), validate(listLeasesSchema), leaseController.list);
leasesRouter.get('/:id', requirePermission('leases:read'), validate(leaseIdParamSchema), leaseController.get);
leasesRouter.post('/', csrfProtection, requirePermission('leases:create'), validate(createLeaseSchema), leaseController.create);
leasesRouter.patch('/:id', csrfProtection, requirePermission('leases:update'), validate(updateLeaseSchema), leaseController.update);
leasesRouter.post('/:id/activate', csrfProtection, requirePermission('leases:update'), validate(leaseIdParamSchema), leaseController.activate);
leasesRouter.post('/:id/terminate', csrfProtection, requirePermission('leases:terminate'), validate(terminateLeaseSchema), leaseController.terminate);
leasesRouter.post('/:id/renew', csrfProtection, requirePermission('leases:renew'), validate(renewLeaseSchema), leaseController.renew);
