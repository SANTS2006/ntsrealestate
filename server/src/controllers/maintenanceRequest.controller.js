import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { parsePagination } from '../utils/pagination.js';
import * as maintenanceService from '../services/maintenanceRequest.service.js';

export const list = asyncHandler(async (req, res) => {
  const { page, pageSize, skip, take } = parsePagination(req.query);
  const result = await maintenanceService.listMaintenanceRequests(req.user.organizationId, req.user, {
    page, pageSize, skip, take, status: req.query.status, priority: req.query.priority, propertyId: req.query.propertyId, tenantId: req.query.tenantId,
  });
  sendSuccess(res, { data: result.requests, meta: result.meta });
});

export const get = asyncHandler(async (req, res) => {
  const request = await maintenanceService.getMaintenanceRequest(req.params.id, req.user.organizationId, req.user);
  sendSuccess(res, { data: request });
});

export const create = asyncHandler(async (req, res) => {
  const request = await maintenanceService.createMaintenanceRequestRecord(req.user.organizationId, req.body, req.user, req);
  sendSuccess(res, { statusCode: 201, data: request, message: 'Maintenance request submitted.' });
});

export const review = asyncHandler(async (req, res) => {
  const request = await maintenanceService.reviewMaintenanceRequest(req.params.id, req.user.organizationId, req.user, req);
  sendSuccess(res, { data: request, message: 'Maintenance request moved to review.' });
});

export const assign = asyncHandler(async (req, res) => {
  const request = await maintenanceService.assignMaintenanceRequestRecord(req.params.id, req.user.organizationId, req.body.vendorId, req.user, req);
  sendSuccess(res, { data: request, message: 'Maintenance request assigned.' });
});

export const cancel = asyncHandler(async (req, res) => {
  const request = await maintenanceService.cancelMaintenanceRequest(req.params.id, req.user.organizationId, req.user, req);
  sendSuccess(res, { data: request, message: 'Maintenance request cancelled.' });
});

export const remove = asyncHandler(async (req, res) => {
  await maintenanceService.deleteMaintenanceRequest(req.params.id, req.user.organizationId, req.user, req);
  sendSuccess(res, { data: null, message: 'Maintenance request deleted.' });
});

export const vendorsForRequest = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await maintenanceService.listVendorsForRequest(req.params.id, req.user.organizationId, req.user) });
});
