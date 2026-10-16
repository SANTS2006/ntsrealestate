import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/authorize.js';
import { csrfProtection } from '../../middleware/csrf.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import { parsePagination } from '../../utils/pagination.js';
import * as dealService from '../../services/deal.service.js';
import * as workflow from '../../services/rentalWorkflow.service.js';
import { listDealsSchema, dealIdParamSchema, requestDealSchema, updateDealStatusSchema, setPlanSchema, renewDealSchema, endDealSchema } from '../../validators/deal.validators.js';

export const dealsRouter = Router();

dealsRouter.use(authenticate);

// Everyone sees only their own slice: a customer their own deals, an owner or
// agent the deals on their properties and lands, an administrator everything.
dealsRouter.get('/', requirePermission('deals:read'), validate(listDealsSchema), asyncHandler(async (req, res) => {
  const { page, pageSize, skip, take } = parsePagination(req.query);
  const result = await dealService.listDeals(req.user.organizationId, req.user, { page, pageSize, skip, take, kind: req.query.kind, status: req.query.status, search: req.query.search });
  sendSuccess(res, { data: result.deals, meta: result.meta });
}));
dealsRouter.get('/:id', requirePermission('deals:read'), validate(dealIdParamSchema), asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await dealService.getDeal(req.params.id, req.user.organizationId, req.user) });
}));
dealsRouter.post('/request', csrfProtection, requirePermission('deals:create'), validate(requestDealSchema), asyncHandler(async (req, res) => {
  const result = await dealService.requestDeal(req.user, req.body, req);
  sendSuccess(res, { statusCode: result.alreadyHeld ? 200 : 201, data: result, message: result.alreadyHeld ? 'You already have this.' : 'Request sent.' });
}));
dealsRouter.patch('/:id/status', csrfProtection, requirePermission('deals:update'), validate(updateDealStatusSchema), asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await dealService.updateDealStatus(req.params.id, req.body.status, req.user.organizationId, req.user, req) });
}));

// The rent / lease workflow, after the request: plan → payments → renew or end.
dealsRouter.put('/:id/plan', csrfProtection, requirePermission('deals:update'), validate(setPlanSchema), asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await workflow.setPlan(req.params.id, req.body, req.user.organizationId, req.user, req), message: 'Payment plan saved.' });
}));
dealsRouter.post('/:id/renew', csrfProtection, requirePermission('deals:update'), validate(renewDealSchema), asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await workflow.renewDeal(req.params.id, req.body, req.user.organizationId, req.user, req), message: 'Renewed.' });
}));
dealsRouter.post('/:id/renewal-request', csrfProtection, requirePermission('deals:read'), validate(dealIdParamSchema), asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await workflow.requestRenewal(req.params.id, req.user.organizationId, req.user, req), message: 'Your agent has been asked to renew.' });
}));
dealsRouter.post('/:id/end', csrfProtection, requirePermission('deals:update'), validate(endDealSchema), asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await workflow.endDeal(req.params.id, req.body, req.user.organizationId, req.user, req), message: 'Ended.' });
}));
