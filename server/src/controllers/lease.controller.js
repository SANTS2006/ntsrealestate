import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { parsePagination } from '../utils/pagination.js';
import * as leaseService from '../services/lease.service.js';

export const list = asyncHandler(async (req, res) => {
  const { page, pageSize, skip, take } = parsePagination(req.query);
  const result = await leaseService.listLeases(req.user.organizationId, req.user, {
    page, pageSize, skip, take, status: req.query.status, tenantId: req.query.tenantId, unitId: req.query.unitId,
  });
  sendSuccess(res, { data: result.leases, meta: result.meta });
});

export const get = asyncHandler(async (req, res) => {
  const lease = await leaseService.getLease(req.params.id, req.user.organizationId, req.user);
  sendSuccess(res, { data: lease });
});

export const create = asyncHandler(async (req, res) => {
  const lease = await leaseService.createLeaseRecord(req.user.organizationId, req.body, req.user, req);
  sendSuccess(res, { statusCode: 201, data: lease, message: 'Lease created as a draft.' });
});

export const update = asyncHandler(async (req, res) => {
  const lease = await leaseService.updateLeaseRecord(req.params.id, req.user.organizationId, req.body, req.user, req);
  sendSuccess(res, { data: lease, message: 'Lease updated.' });
});

export const activate = asyncHandler(async (req, res) => {
  const lease = await leaseService.activateLease(req.params.id, req.user.organizationId, req.user, req);
  sendSuccess(res, { data: lease, message: 'Lease activated.' });
});

export const terminate = asyncHandler(async (req, res) => {
  const lease = await leaseService.terminateLease(req.params.id, req.user.organizationId, req.body, req.user, req);
  sendSuccess(res, { data: lease, message: 'Lease terminated.' });
});

export const renew = asyncHandler(async (req, res) => {
  const lease = await leaseService.renewLease(req.params.id, req.user.organizationId, req.body, req.user, req);
  sendSuccess(res, { data: lease, message: 'Lease renewed.' });
});
