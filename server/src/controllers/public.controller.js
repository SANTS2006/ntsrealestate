import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { parsePagination } from '../utils/pagination.js';
import * as publicListingService from '../services/publicListing.service.js';
import * as publicInquiryService from '../services/publicInquiry.service.js';

// Set by middleware/resolvePublicOrg.js from the URL name in the path.
const orgId = (req) => req.publicOrgId;

export const listListings = asyncHandler(async (req, res) => {
  const { page, pageSize, skip, take } = parsePagination(req.query);
  const result = await publicListingService.listPublicListings(orgId(req), {
    page, pageSize, skip, take,
    city: req.query.neighborhood,
    unitType: req.query.type,
    maxPrice: req.query.maxPrice,
    minPrice: req.query.minPrice,
    minBedrooms: req.query.minBeds,
    minBathrooms: req.query.minBaths,
    kind: req.query.kind,
    offer: req.query.offer,
    furnished: req.query.furnished === 'true',
    amenities: req.query.amenities ? req.query.amenities.split(',').map((a) => a.trim()).filter(Boolean).slice(0, 10) : [],
    q: req.query.q,
    sort: req.query.sort,
  });
  sendSuccess(res, { data: result.listings, meta: result.meta });
});

export const getListing = asyncHandler(async (req, res) => {
  const listing = await publicListingService.getPublicListing(req.params.id, orgId(req));
  sendSuccess(res, { data: listing });
});

export const getFilterOptions = asyncHandler(async (req, res) => {
  const options = await publicListingService.getPublicFilterOptions(orgId(req), req.query.offer);
  sendSuccess(res, { data: options });
});

export const getAgents = asyncHandler(async (req, res) => {
  const agents = await publicListingService.getPublicAgents(orgId(req));
  sendSuccess(res, { data: agents });
});

export const getStats = asyncHandler(async (req, res) => {
  const stats = await publicListingService.getPublicStats(orgId(req));
  sendSuccess(res, { data: stats });
});

export const createListingInquiry = asyncHandler(async (req, res) => {
  const result = await publicInquiryService.sendListingInquiry(orgId(req), { listingId: req.params.id, ...req.body });
  sendSuccess(res, { statusCode: 201, data: result, message: 'Your message has been sent.' });
});

export const createGeneralContact = asyncHandler(async (req, res) => {
  const result = await publicInquiryService.sendGeneralContact(orgId(req), req.body);
  sendSuccess(res, { statusCode: 201, data: result, message: 'Your message has been sent.' });
});
