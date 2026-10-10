import { asyncHandler } from '../utils/asyncHandler.js';
import { getOwnerConnections } from '../services/connections.service.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { parsePagination } from '../utils/pagination.js';
import * as ownerService from '../services/owner.service.js';
import { getMyOrganization } from '../services/organization.service.js';
import { getUser } from '../services/user.service.js';

export const list = asyncHandler(async (req, res) => {
  const { page, pageSize, skip, take } = parsePagination(req.query);
  const result = await ownerService.listOwners(req.user.organizationId, req.user, { page, pageSize, skip, take, search: req.query.search, status: req.query.status });
  sendSuccess(res, { data: result.owners, meta: result.meta });
});

export const options = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await ownerService.listOwnerOptions(req.user.organizationId, req.user) });
});

export const get = asyncHandler(async (req, res) => {
  const owner = await ownerService.getOwner(req.params.id, req.user.organizationId, req.user);
  sendSuccess(res, { data: owner });
});

export const create = asyncHandler(async (req, res) => {
  const [organization, me] = await Promise.all([getMyOrganization(req.user.organizationId), getUser(req.user.id, req.user.organizationId)]);
  const invitedBy = { id: req.user.id, name: `${me.firstName} ${me.lastName}`, organization };
  const owner = await ownerService.createOwnerRecord(req.user.organizationId, req.body, req.user, req, invitedBy);
  sendSuccess(res, { statusCode: 201, data: owner, message: owner.invited ? 'Owner added and invitation sent.' : 'Owner created.' });
});

export const update = asyncHandler(async (req, res) => {
  const owner = await ownerService.updateOwnerRecord(req.params.id, req.user.organizationId, req.body, req.user, req);
  sendSuccess(res, { data: owner, message: 'Owner updated.' });
});

export const setStatus = asyncHandler(async (req, res) => {
  const owner = await ownerService.setOwnerActiveStatus(req.params.id, req.user.organizationId, req.body.status, req.user, req);
  sendSuccess(res, { data: owner, message: 'Owner status updated.' });
});

export const connections = asyncHandler(async (req, res) => {
  await ownerService.getOwner(req.params.id, req.user.organizationId, req.user);
  sendSuccess(res, { data: await getOwnerConnections(req.params.id, req.user.organizationId) });
});
