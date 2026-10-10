import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { csrfProtection } from '../../middleware/csrf.js';
import { validate } from '../../middleware/validate.js';
import * as notificationController from '../../controllers/notification.controller.js';
import { listNotificationsSchema, notificationIdParamSchema } from '../../validators/notification.validators.js';

export const notificationsRouter = Router();

// No requirePermission gate here, unlike every other resource — a
// notification is inherently the caller's own (every query in
// notification.service.js is filtered by req.user.id), so every
// authenticated user manages their own regardless of role/permission
// catalog, the same way GET /auth/me needs no separate permission.
notificationsRouter.use(authenticate);

notificationsRouter.get('/', validate(listNotificationsSchema), notificationController.list);
notificationsRouter.get('/:id', validate(notificationIdParamSchema), notificationController.getOne);
notificationsRouter.post('/read-all', csrfProtection, notificationController.markAllRead);
notificationsRouter.post('/:id/read', csrfProtection, validate(notificationIdParamSchema), notificationController.markRead);
