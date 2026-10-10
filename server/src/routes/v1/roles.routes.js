import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/authorize.js';
import { csrfProtection } from '../../middleware/csrf.js';
import { validate } from '../../middleware/validate.js';
import * as roleController from '../../controllers/role.controller.js';
import { roleIdParamSchema, createRoleSchema, updateRoleSchema, setRolePermissionsSchema } from '../../validators/role.validators.js';

export const rolesRouter = Router();

rolesRouter.use(authenticate);

rolesRouter.get('/', requirePermission('roles:read'), roleController.getRoles);
rolesRouter.get('/:id', requirePermission('roles:read'), validate(roleIdParamSchema), roleController.getRole);
rolesRouter.post('/', csrfProtection, requirePermission('roles:create'), validate(createRoleSchema), roleController.createRole);
rolesRouter.patch('/:id', csrfProtection, requirePermission('roles:update'), validate(updateRoleSchema), roleController.updateRole);
rolesRouter.delete('/:id', csrfProtection, requirePermission('roles:delete'), validate(roleIdParamSchema), roleController.deleteRole);
rolesRouter.put('/:id/permissions', csrfProtection, requirePermission('roles:update'), validate(setRolePermissionsSchema), roleController.setPermissions);
