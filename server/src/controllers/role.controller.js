import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import * as roleService from '../services/role.service.js';

export const getRoles = asyncHandler(async (req, res) => {
  const roles = await roleService.listRoles(req.user.organizationId);
  sendSuccess(res, { data: roles });
});

export const getRole = asyncHandler(async (req, res) => {
  const role = await roleService.getRole(req.params.id, req.user.organizationId);
  sendSuccess(res, { data: role });
});

export const createRole = asyncHandler(async (req, res) => {
  const role = await roleService.createRoleRecord(req.user.organizationId, req.body, req.user, req);
  sendSuccess(res, { statusCode: 201, data: role, message: 'Role created.' });
});

export const updateRole = asyncHandler(async (req, res) => {
  const role = await roleService.updateRoleRecord(req.params.id, req.user.organizationId, req.body, req.user, req);
  sendSuccess(res, { data: role, message: 'Role updated.' });
});

export const deleteRole = asyncHandler(async (req, res) => {
  const result = await roleService.deleteRoleRecord(req.params.id, req.user.organizationId, req.user, req);
  sendSuccess(res, { data: result, message: 'Role deleted.' });
});

export const setPermissions = asyncHandler(async (req, res) => {
  const role = await roleService.setRolePermissionsRecord(req.params.id, req.user.organizationId, req.body.permissionNames, req.user, req);
  sendSuccess(res, { data: role, message: 'Role permissions updated.' });
});
