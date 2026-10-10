import { asyncHandler } from '../utils/asyncHandler.js';
import { getTenantConnections } from '../services/connections.service.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { parsePagination } from '../utils/pagination.js';
import * as tenantService from '../services/tenant.service.js';

export const list = asyncHandler(async (req, res) => {
  const { page, pageSize, skip, take } = parsePagination(req.query);
  const result = await tenantService.listTenants(req.user.organizationId, req.user, {
    page, pageSize, skip, take, search: req.query.search, status: req.query.status, unitId: req.query.unitId, buildingId: req.query.buildingId,
  });
  sendSuccess(res, { data: result.tenants, meta: result.meta });
});

export const get = asyncHandler(async (req, res) => {
  const tenant = await tenantService.getTenant(req.params.id, req.user.organizationId, req.user);
  sendSuccess(res, { data: tenant });
});

export const create = asyncHandler(async (req, res) => {
  const tenant = await tenantService.createTenantRecord(req.user.organizationId, req.body, req.user, req);
  sendSuccess(res, { statusCode: 201, data: tenant, message: 'Tenant created.' });
});

export const update = asyncHandler(async (req, res) => {
  const tenant = await tenantService.updateTenantRecord(req.params.id, req.user.organizationId, req.body, req.user, req);
  sendSuccess(res, { data: tenant, message: 'Tenant updated.' });
});

export const setStatus = asyncHandler(async (req, res) => {
  const tenant = await tenantService.setTenantActiveStatus(req.params.id, req.user.organizationId, req.body.status, req.user, req);
  sendSuccess(res, { data: tenant, message: 'Tenant status updated.' });
});

export const connections = asyncHandler(async (req, res) => {
  await tenantService.getTenant(req.params.id, req.user.organizationId, req.user);
  sendSuccess(res, { data: await getTenantConnections(req.params.id, req.user.organizationId) });
});
