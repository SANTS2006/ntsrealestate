import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/authorize.js';
import { csrfProtection } from '../../middleware/csrf.js';
import { validate } from '../../middleware/validate.js';
import * as permissionController from '../../controllers/permission.controller.js';
import { createPermissionSchema, permissionIdParamSchema, updatePermissionSchema } from '../../validators/permission.validators.js';

export const permissionsRouter = Router();

permissionsRouter.use(authenticate);

// Gated by roles:read/roles:update/roles:delete rather than a dedicated
// permissions:* resource — permissions are purely role-configuration data
// (there's nothing else in the product surface you'd do with them), so they
// ride on the same permission checks as the roles screen that manages them.
permissionsRouter.get('/', requirePermission('roles:read'), permissionController.list);
permissionsRouter.post('/', csrfProtection, requirePermission('roles:update'), validate(createPermissionSchema), permissionController.create);
permissionsRouter.patch('/:id', csrfProtection, requirePermission('roles:update'), validate(updatePermissionSchema), permissionController.update);
permissionsRouter.delete('/:id', csrfProtection, requirePermission('roles:delete'), validate(permissionIdParamSchema), permissionController.remove);
