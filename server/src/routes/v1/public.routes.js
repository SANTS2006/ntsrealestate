import { Router } from 'express';
import { listPublicOrganizations } from '../../services/publicDirectory.service.js';
import { validate } from '../../middleware/validate.js';
import { authRateLimiter } from '../../middleware/security.js';
import { resolvePublicOrg } from '../../middleware/resolvePublicOrg.js';
import * as publicController from '../../controllers/public.controller.js';
import * as publicLandService from '../../services/publicLand.service.js';
import { getPublicMaintenanceStatus } from '../../services/maintenanceMode.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import { parsePagination } from '../../utils/pagination.js';
import {
  listPublicListingsSchema, listPublicLandsSchema, publicListingIdParamSchema, listingInquirySchema, generalContactSchema,
} from '../../validators/public.validators.js';

// No `authenticate` here — this router is the one deliberately unauthenticated
// surface in the API, serving the public listings site (a separate
// deployment/origin from the tenant/staff portal). Its access boundary is
// entirely inside publicListing.repository.js's query filters (organization
// + availability), the strict CORS origin allowlist, and rate limiting on
// the two write endpoints below — never a session or permission check,
// since there is no principal to check one against.
export const publicRouter = Router();

// Read by every open page (and the public website) to know whether to show
// the maintenance notice.
publicRouter.get('/system-status', asyncHandler(async (req, res) => {
  sendSuccess(res, { data: { maintenance: await getPublicMaintenanceStatus() } });
}));

// One router, mounted twice: under /orgs/:orgSlug (the way every site should
// use it) and bare (legacy, via PRIMARY_ORGANIZATION_ID).
const companyRouter = Router({ mergeParams: true });
companyRouter.use(resolvePublicOrg);

companyRouter.get('/listings', validate(listPublicListingsSchema), publicController.listListings);
companyRouter.get('/listings/filter-options', publicController.getFilterOptions);
companyRouter.get('/listings/:id', validate(publicListingIdParamSchema), publicController.getListing);
companyRouter.get('/lands', validate(listPublicLandsSchema), asyncHandler(async (req, res) => {
  const { page, pageSize, skip, take } = parsePagination(req.query);
  const q = req.query;
  const result = await publicLandService.listPublicLands(req.publicOrgId, {
    page, pageSize, skip, take, sort: q.sort, q: q.q, type: q.type, city: q.city, minPrice: q.minPrice, maxPrice: q.maxPrice, minArea: q.minArea,
  });
  sendSuccess(res, { data: result.lands, meta: result.meta });
}));
companyRouter.get('/lands/filter-options', asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await publicLandService.getPublicLandOptions(req.publicOrgId) });
}));
companyRouter.get('/lands/:id', validate(publicListingIdParamSchema), asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await publicLandService.getPublicLand(req.params.id, req.publicOrgId) });
}));
companyRouter.get('/agents', publicController.getAgents);
companyRouter.get('/stats', publicController.getStats);

// `authRateLimiter` isn't auth-specific in what it does (IP+email keyed
// rate limiting) — reused here to stop the public site's forms being used
// as a spam/email relay, the same way it stops login/reset brute-forcing.
companyRouter.post('/listings/:id/inquiries', authRateLimiter(10), validate(listingInquirySchema), publicController.createListingInquiry);
companyRouter.post('/contact', authRateLimiter(10), validate(generalContactSchema), publicController.createGeneralContact);

// The platform home page's list of companies (name, logo, sign-in slug only).
publicRouter.get('/organizations', async (req, res, next) => {
  try { res.json({ success: true, data: await listPublicOrganizations() }); } catch (err) { next(err); }
});

publicRouter.use('/orgs/:orgSlug', companyRouter);
publicRouter.use('/', companyRouter);
