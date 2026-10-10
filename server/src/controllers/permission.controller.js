import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import * as permissionService from '../services/permission.service.js';

export const list = asyncHandler(async (req, res) => {
  const permissions = await permissionService.listPermissions();
  sendSuccess(res, { data: permissions });
});

export const create = asyncHandler(async (req, res) => {
  const permission = await permissionService.createPermissionRecord(req.user.organizationId, req.body, req.user, req);
  sendSuccess(res, { statusCode: 201, data: permission, message: 'Permission created.' });
});

export const update = asyncHandler(async (req, res) => {
  const permission = await permissionService.updatePermissionRecord(req.params.id, req.user.organizationId, req.body, req.user, req);
  sendSuccess(res, { data: permission, message: 'Permission updated.' });
});

export const remove = asyncHandler(async (req, res) => {
  const result = await permissionService.deletePermissionRecord(req.params.id, req.user.organizationId, req.user, req);
  sendSuccess(res, { data: result, message: 'Permission deleted.' });
});
