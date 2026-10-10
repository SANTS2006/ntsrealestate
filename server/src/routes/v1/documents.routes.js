import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/authorize.js';
import { csrfProtection } from '../../middleware/csrf.js';
import { validate } from '../../middleware/validate.js';
import { singleFileUpload } from '../../middleware/upload.js';
import * as documentController from '../../controllers/document.controller.js';
import { uploadDocumentSchema, listDocumentsSchema, documentIdParamSchema } from '../../validators/document.validators.js';

export const documentsRouter = Router();

documentsRouter.use(authenticate);

// Multer runs before validate() so entityType/entityId (regular multipart
// fields) land in req.body the same way a JSON body would - the Zod schema
// doesn't need to know the request was multipart.
documentsRouter.post(
  '/',
  csrfProtection,
  requirePermission('documents:create'),
  singleFileUpload('file'),
  validate(uploadDocumentSchema),
  documentController.upload
);

// Self-service avatar upload — deliberately NOT gated by `documents:create`.
// Every authenticated user (even accountant/owner/tenant/auditor, who hold
// no generic document-create permission) may attach a photo to their own
// user record; entityId is forced to the caller's own id server-side, so
// this can never be used to write a document anywhere else. See
// document.controller.js#uploadAvatar.
documentsRouter.post('/avatar', csrfProtection, singleFileUpload('file'), documentController.uploadAvatar);

documentsRouter.get('/', requirePermission('documents:read'), validate(listDocumentsSchema), documentController.list);
documentsRouter.get('/:id/access-url', requirePermission('documents:download'), validate(documentIdParamSchema), documentController.getAccessUrl);
documentsRouter.delete('/:id', csrfProtection, requirePermission('documents:delete'), validate(documentIdParamSchema), documentController.remove);
