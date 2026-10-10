import express, { Router } from 'express';
import { authenticateChatActor } from '../../middleware/chatAuth.js';
import { csrfProtection } from '../../middleware/csrf.js';
import { validate } from '../../middleware/validate.js';
import { chatRateLimiter } from '../../middleware/security.js';
import * as chatController from '../../controllers/chat.controller.js';
import {
  roomIdParamSchema, attachmentIdParamSchema, saveKeySchema, openDirectSchema, distributeKeysSchema,
  listMessagesSchema, sendMessageSchema,
} from '../../validators/chat.validators.js';

// Everything here is ciphertext: the server stores and relays what browsers
// encrypted and never sees message text or file contents.
export const chatRouter = Router();

chatRouter.use(authenticateChatActor, chatRateLimiter);

chatRouter.get('/keys/me', chatController.getKeys);
chatRouter.put('/keys/me', csrfProtection, validate(saveKeySchema), chatController.saveKeys);
chatRouter.get('/ice-servers', chatController.iceServers);
chatRouter.get('/directory', chatController.directory);

chatRouter.get('/rooms', chatController.listRooms);
chatRouter.post('/rooms/direct', csrfProtection, validate(openDirectSchema), chatController.openDirect);
chatRouter.get('/rooms/:roomId', validate(roomIdParamSchema), chatController.getRoom);
chatRouter.put('/rooms/:roomId/keys', csrfProtection, validate(distributeKeysSchema), chatController.distributeKeys);
chatRouter.get('/rooms/:roomId/messages', validate(listMessagesSchema), chatController.listMessages);
chatRouter.post('/rooms/:roomId/messages', csrfProtection, validate(sendMessageSchema), chatController.sendMessage);
chatRouter.post('/rooms/:roomId/read', csrfProtection, validate(roomIdParamSchema), chatController.markRead);
chatRouter.post(
  '/rooms/:roomId/attachments',
  csrfProtection,
  express.raw({ type: 'application/octet-stream', limit: '26mb' }),
  validate(roomIdParamSchema),
  chatController.uploadAttachment,
);
chatRouter.get('/attachments/:attachmentId', validate(attachmentIdParamSchema), chatController.downloadAttachment);
