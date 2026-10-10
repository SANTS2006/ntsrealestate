import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { parsePagination } from '../utils/pagination.js';
import * as propertyService from '../services/property.service.js';

export const list = asyncHandler(async (req, res) => {
  const { page, pageSize, skip, take } = parsePagination(req.query);
  const result = await propertyService.listProperties(req.user.organizationId, req.user, { page, pageSize, skip, take, search: req.query.search, status: req.query.status });
  sendSuccess(res, { data: result.properties, meta: result.meta });
});

export const get = asyncHandler(async (req, res) => {
  const property = await propertyService.getProperty(req.params.id, req.user.organizationId, req.user);
  sendSuccess(res, { data: property });
});

export const create = asyncHandler(async (req, res) => {
  const property = await propertyService.createPropertyRecord(req.user.organizationId, req.body, req.user, req);
  sendSuccess(res, { statusCode: 201, data: property, message: 'Property created.' });
});

export const update = asyncHandler(async (req, res) => {
  const property = await propertyService.updatePropertyRecord(req.params.id, req.user.organizationId, req.body, req.user, req);
  sendSuccess(res, { data: property, message: 'Property updated.' });
});

export const archive = asyncHandler(async (req, res) => {
  const result = await propertyService.archiveProperty(req.params.id, req.user.organizationId, req.user, req);
  sendSuccess(res, { data: result, message: 'Property archived.' });
});

export const listAssignments = asyncHandler(async (req, res) => {
  const assignments = await propertyService.listPropertyAssignments(req.params.id, req.user.organizationId, req.user);
  sendSuccess(res, { data: assignments });
});

export const assignStaff = asyncHandler(async (req, res) => {
  const result = await propertyService.assignStaffToProperty(req.params.id, req.user.organizationId, req.body.userId, req.user, req);
  sendSuccess(res, { data: result, message: 'Staff member assigned to property.' });
});

export const unassignStaff = asyncHandler(async (req, res) => {
  const result = await propertyService.unassignStaffFromProperty(req.params.id, req.user.organizationId, req.params.userId, req.user, req);
  sendSuccess(res, { data: result, message: 'Staff member unassigned from property.' });
});
