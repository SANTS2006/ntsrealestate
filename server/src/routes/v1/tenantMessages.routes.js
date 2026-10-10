import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission, requireAnyPermission } from '../../middleware/authorize.js';
import { csrfProtection } from '../../middleware/csrf.js';
import { validate } from '../../middleware/validate.js';
import * as tenantMessageController from '../../controllers/tenantMessage.controller.js';
import { uuidParam } from '../../validators/common.validators.js';
import { z } from 'zod';
import { listTenantMessagesSchema, createTenantMessageSchema } from '../../validators/tenantMessage.validators.js';

export const tenantMessagesRouter = Router();

tenantMessagesRouter.use(authenticate);
// Tenants list the messages they sent; staff read their inbox (administrators: all).
tenantMessagesRouter.get('/', requireAnyPermission(['tenant-messages:read', 'tenant-messages:create']), validate(listTenantMessagesSchema), tenantMessageController.list);
tenantMessagesRouter.get('/:id', requireAnyPermission(['tenant-messages:read', 'tenant-messages:create']), validate(z.object({ params: z.object(uuidParam('id')) })), tenantMessageController.getOne);
tenantMessagesRouter.post('/', csrfProtection, requirePermission('tenant-messages:create'), validate(createTenantMessageSchema), tenantMessageController.create);
