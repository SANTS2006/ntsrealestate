import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/authorize.js';
import { csrfProtection } from '../../middleware/csrf.js';
import { validate } from '../../middleware/validate.js';
import * as userController from '../../controllers/user.controller.js';
import {
  listUsersSchema, getUserSchema, inviteUserSchema, updateUserStatusSchema, updateUserRoleSchema, removeUserRoleSchema,
} from '../../validators/user.validators.js';

export const usersRouter = Router();

usersRouter.use(authenticate);

usersRouter.get('/', requirePermission('users:read'), validate(listUsersSchema), userController.listUsers);
usersRouter.get('/:id', requirePermission('users:read'), validate(getUserSchema), userController.getUser);
usersRouter.post('/invite', csrfProtection, requirePermission('users:invite'), validate(inviteUserSchema), userController.inviteUser);
usersRouter.patch('/:id/status', csrfProtection, requirePermission('users:update'), validate(updateUserStatusSchema), userController.updateUserStatus);
usersRouter.post('/:id/roles', csrfProtection, requirePermission('users:change-role'), validate(updateUserRoleSchema), userController.addUserRole);
usersRouter.delete('/:id/roles/:role', csrfProtection, requirePermission('users:change-role'), validate(removeUserRoleSchema), userController.removeUserRole);
usersRouter.patch('/:id/role', csrfProtection, requirePermission('users:change-role'), validate(updateUserRoleSchema), userController.updateUserRole);
usersRouter.delete('/:id', csrfProtection, requirePermission('users:delete'), validate(getUserSchema), userController.deleteUser);
