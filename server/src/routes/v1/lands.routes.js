import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/authorize.js';
import { csrfProtection } from '../../middleware/csrf.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import { parsePagination } from '../../utils/pagination.js';
import * as landService from '../../services/land.service.js';
import { listLandsSchema, landIdParamSchema, createLandSchema, updateLandSchema } from '../../validators/land.validators.js';

export const landsRouter = Router();

landsRouter.use(authenticate);

landsRouter.get('/', requirePermission('lands:read'), validate(listLandsSchema), asyncHandler(async (req, res) => {
  const { page, pageSize, skip, take } = parsePagination(req.query);
  const result = await landService.listLands(req.user.organizationId, req.user, { page, pageSize, skip, take, search: req.query.search, status: req.query.status });
  sendSuccess(res, { data: result.lands, meta: result.meta });
}));
landsRouter.get('/:id', requirePermission('lands:read'), validate(landIdParamSchema), asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await landService.getLand(req.params.id, req.user.organizationId, req.user) });
}));
landsRouter.post('/', csrfProtection, requirePermission('lands:create'), validate(createLandSchema), asyncHandler(async (req, res) => {
  sendSuccess(res, { statusCode: 201, data: await landService.createLandRecord(req.user.organizationId, req.body, req.user, req), message: 'Land added.' });
}));
landsRouter.patch('/:id', csrfProtection, requirePermission('lands:update'), validate(updateLandSchema), asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await landService.updateLandRecord(req.params.id, req.user.organizationId, req.body, req.user, req) });
}));
landsRouter.delete('/:id', csrfProtection, requirePermission('lands:delete'), validate(landIdParamSchema), asyncHandler(async (req, res) => {
  await landService.deleteLandRecord(req.params.id, req.user.organizationId, req.user, req);
  sendSuccess(res, { data: null, message: 'Land deleted.' });
}));
