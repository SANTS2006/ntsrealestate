import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { AppError } from '../utils/AppError.js';
import { parsePagination } from '../utils/pagination.js';
import * as documentService from '../services/document.service.js';

export const upload = asyncHandler(async (req, res) => {
  if (!req.file) throw AppError.badRequest('No file was uploaded.');

  const document = await documentService.uploadDocument(
    {
      organizationId: req.user.organizationId,
      entityType: req.body.entityType,
      entityId: req.body.entityId,
      actingUser: req.user,
      file: req.file,
    },
    req
  );
  sendSuccess(res, { statusCode: 201, data: document, message: 'File uploaded successfully.' });
});

// entityType/entityId are hard-coded to the caller's own user record —
// never taken from the request — so this route is safe to expose without
// the generic `documents:create` permission gate (see routes/documents.js).
export const uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file) throw AppError.badRequest('No file was uploaded.');

  const document = await documentService.uploadDocument(
    {
      organizationId: req.user.organizationId,
      entityType: 'user',
      entityId: req.user.id,
      actingUser: req.user,
      file: req.file,
    },
    req
  );
  sendSuccess(res, { statusCode: 201, data: document, message: 'Profile photo updated.' });
});

export const list = asyncHandler(async (req, res) => {
  const { page, pageSize, skip, take } = parsePagination(req.query);
  const result = await documentService.listDocuments(req.user.organizationId, req.query.entityType, req.query.entityId, req.user, { page, pageSize, skip, take });
  sendSuccess(res, { data: result.documents, meta: result.meta });
});

export const getAccessUrl = asyncHandler(async (req, res) => {
  const result = await documentService.getDocumentAccessUrl(req.params.id, req.user.organizationId, req.user, req);
  sendSuccess(res, { data: result });
});

export const remove = asyncHandler(async (req, res) => {
  const result = await documentService.deleteDocument(req.params.id, req.user.organizationId, req.user, req);
  sendSuccess(res, { data: result, message: 'Document deleted.' });
});
