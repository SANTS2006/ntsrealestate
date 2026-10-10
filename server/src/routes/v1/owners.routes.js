import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/authorize.js';
import { csrfProtection } from '../../middleware/csrf.js';
import { validate } from '../../middleware/validate.js';
import * as ownerController from '../../controllers/owner.controller.js';
import {
  listOwnersSchema, ownerIdParamSchema, createOwnerSchema, updateOwnerSchema, setOwnerStatusSchema,
} from '../../validators/owner.validators.js';

export const ownersRouter = Router();

ownersRouter.use(authenticate);

ownersRouter.get('/', requirePermission('owners:read'), validate(listOwnersSchema), ownerController.list);
ownersRouter.get('/options', requirePermission('owners:read'), ownerController.options);
ownersRouter.get('/:id/connections', requirePermission('owners:read'), validate(ownerIdParamSchema), ownerController.connections);
ownersRouter.get('/:id', requirePermission('owners:read'), validate(ownerIdParamSchema), ownerController.get);
ownersRouter.post('/', csrfProtection, requirePermission('owners:create'), validate(createOwnerSchema), ownerController.create);
ownersRouter.patch('/:id', csrfProtection, requirePermission('owners:update'), validate(updateOwnerSchema), ownerController.update);
ownersRouter.patch('/:id/status', csrfProtection, requirePermission('owners:update'), validate(setOwnerStatusSchema), ownerController.setStatus);
