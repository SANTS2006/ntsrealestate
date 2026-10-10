import { asyncHandler } from '../utils/asyncHandler.js';
import { ensureRoleProfile } from '../services/roleProfile.service.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { parsePagination } from '../utils/pagination.js';
import * as userService from '../services/user.service.js';
import { purgeUser } from '../services/userPurge.service.js';
import { getMyOrganization } from '../services/organization.service.js';

export const listUsers = asyncHandler(async (req, res) => {
  const { page, pageSize, skip, take } = parsePagination(req.query);
  const result = await userService.listUsers(req.user.organizationId, { page, pageSize, skip, take, search: req.query.search, status: req.query.status });
  sendSuccess(res, { data: result.users, meta: result.meta });
});

export const getUser = asyncHandler(async (req, res) => {
  const user = await userService.getUser(req.params.id, req.user.organizationId);
  sendSuccess(res, { data: user });
});

export const inviteUser = asyncHandler(async (req, res) => {
  const [organization, actingUser] = await Promise.all([
    getMyOrganization(req.user.organizationId),
    userService.getUser(req.user.id, req.user.organizationId),
  ]);
  const user = await userService.inviteUser(
    {
      organizationId: req.user.organizationId,
      invitedBy: { id: req.user.id, name: `${actingUser.firstName} ${actingUser.lastName}`, organization },
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      email: req.body.email,
      roleName: req.body.role,
    },
    req
  );
  await ensureRoleProfile(user.id, req.user.organizationId, req.body.role);
  sendSuccess(res, { statusCode: 201, data: user, message: 'Invitation sent.' });
});

export const updateUserStatus = asyncHandler(async (req, res) => {
  const user = await userService.updateUserStatus(req.params.id, req.user.organizationId, req.body.status, req.user, req);
  sendSuccess(res, { data: user, message: 'User status updated.' });
});

export const updateUserRole = asyncHandler(async (req, res) => {
  const user = await userService.updateUserRole(req.params.id, req.user.organizationId, req.body.role, req.user, req);
  sendSuccess(res, { data: user, message: 'User role updated.' });
});

export const deleteUser = asyncHandler(async (req, res) => {
  await purgeUser(req.params.id, req.user.organizationId, req.user, req);
  sendSuccess(res, { data: null, message: 'User permanently deleted.' });
});

export const addUserRole = asyncHandler(async (req, res) => {
  const user = await userService.addUserRole(req.params.id, req.user.organizationId, req.body.role, req.user, req);
  sendSuccess(res, { data: user, message: 'Role added.' });
});

export const removeUserRole = asyncHandler(async (req, res) => {
  const user = await userService.removeUserRole(req.params.id, req.user.organizationId, req.params.role, req.user, req);
  sendSuccess(res, { data: user, message: 'Role removed.' });
});
