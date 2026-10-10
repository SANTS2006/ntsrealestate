import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/authorize.js';
import { csrfProtection } from '../../middleware/csrf.js';
import { validate } from '../../middleware/validate.js';
import * as tenantController from '../../controllers/tenant.controller.js';
import {
  listTenantsSchema, tenantIdParamSchema, createTenantSchema, updateTenantSchema, setTenantStatusSchema,
} from '../../validators/tenant.validators.js';

export const tenantsRouter = Router();

tenantsRouter.use(authenticate);

tenantsRouter.get('/', requirePermission('tenants:read'), validate(listTenantsSchema), tenantController.list);
tenantsRouter.get('/:id/connections', requirePermission('tenants:read'), validate(tenantIdParamSchema), tenantController.connections);
tenantsRouter.get('/:id', requirePermission('tenants:read'), validate(tenantIdParamSchema), tenantController.get);
tenantsRouter.post('/', csrfProtection, requirePermission('tenants:create'), validate(createTenantSchema), tenantController.create);
tenantsRouter.patch('/:id', csrfProtection, requirePermission('tenants:update'), validate(updateTenantSchema), tenantController.update);
tenantsRouter.patch('/:id/status', csrfProtection, requirePermission('tenants:update'), validate(setTenantStatusSchema), tenantController.setStatus);
