import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import * as agentService from '../services/ownerAgent.service.js';
import { getMyOrganization } from '../services/organization.service.js';
import { getUser } from '../services/user.service.js';

export const list = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await agentService.listAgentLinks(req.user, req.user.organizationId) });
});

export const add = asyncHandler(async (req, res) => {
  const [organization, me] = await Promise.all([getMyOrganization(req.user.organizationId), getUser(req.user.id, req.user.organizationId)]);
  const link = await agentService.addAgent(
    req.user, req.user.organizationId, req.body,
    { id: req.user.id, name: `${me.firstName} ${me.lastName}`, organization }, req,
  );
  sendSuccess(res, { statusCode: 201, data: link, message: 'Agent added.' });
});

export const update = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await agentService.updateAgent(req.params.linkId, req.user, req.user.organizationId, req.body, req), message: 'Agent updated.' });
});

export const setStatus = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await agentService.setAgentLinkStatus(req.params.linkId, req.user, req.user.organizationId, req.body.status, req) });
});

export const remove = asyncHandler(async (req, res) => {
  const result = await agentService.removeAgent(req.params.linkId, req.user, req.user.organizationId, req);
  sendSuccess(res, { data: result, message: result.accountDeleted ? 'Agent removed and their account deleted.' : 'Agent removed.' });
});
