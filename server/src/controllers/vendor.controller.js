import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { parsePagination } from '../utils/pagination.js';
import * as vendorService from '../services/vendor.service.js';

export const list = asyncHandler(async (req, res) => {
  const { page, pageSize, skip, take } = parsePagination(req.query);
  const result = await vendorService.listVendors(req.user.organizationId, { page, pageSize, skip, take, search: req.query.search, status: req.query.status, serviceType: req.query.serviceType });
  sendSuccess(res, { data: result.vendors, meta: result.meta });
});

export const get = asyncHandler(async (req, res) => {
  const vendor = await vendorService.getVendor(req.params.id, req.user.organizationId);
  sendSuccess(res, { data: vendor });
});

export const create = asyncHandler(async (req, res) => {
  const vendor = await vendorService.createVendorRecord(req.user.organizationId, req.body, req.user, req);
  sendSuccess(res, { statusCode: 201, data: vendor, message: 'Vendor created.' });
});

export const update = asyncHandler(async (req, res) => {
  const vendor = await vendorService.updateVendorRecord(req.params.id, req.user.organizationId, req.body, req.user, req);
  sendSuccess(res, { data: vendor, message: 'Vendor updated.' });
});

export const setStatus = asyncHandler(async (req, res) => {
  const vendor = await vendorService.setVendorActiveStatus(req.params.id, req.user.organizationId, req.body.status, req.user, req);
  sendSuccess(res, { data: vendor, message: 'Vendor status updated.' });
});

export const remove = asyncHandler(async (req, res) => {
  await vendorService.deleteVendorRecord(req.params.id, req.user.organizationId, req.user, req);
  sendSuccess(res, { data: null, message: 'Vendor deleted.' });
});
