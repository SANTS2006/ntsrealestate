import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/authorize.js';
import { csrfProtection } from '../../middleware/csrf.js';
import { validate } from '../../middleware/validate.js';
import * as vendorController from '../../controllers/vendor.controller.js';
import {
  listVendorsSchema, vendorIdParamSchema, createVendorSchema, updateVendorSchema, setVendorStatusSchema,
} from '../../validators/vendor.validators.js';

export const vendorsRouter = Router();

vendorsRouter.use(authenticate);

vendorsRouter.get('/', requirePermission('vendors:read'), validate(listVendorsSchema), vendorController.list);
vendorsRouter.get('/:id', requirePermission('vendors:read'), validate(vendorIdParamSchema), vendorController.get);
vendorsRouter.post('/', csrfProtection, requirePermission('vendors:create'), validate(createVendorSchema), vendorController.create);
vendorsRouter.patch('/:id', csrfProtection, requirePermission('vendors:update'), validate(updateVendorSchema), vendorController.update);
vendorsRouter.patch('/:id/status', csrfProtection, requirePermission('vendors:update'), validate(setVendorStatusSchema), vendorController.setStatus);
vendorsRouter.delete('/:id', csrfProtection, requirePermission('vendors:delete'), validate(vendorIdParamSchema), vendorController.remove);
