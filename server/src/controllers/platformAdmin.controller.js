import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import * as platformAdminService from '../services/platformAdmin.service.js';
import * as accountService from '../services/platformAdminAccount.service.js';
import { listPlatformAuditLogs } from '../services/platformAudit.service.js';
import { parsePagination } from '../utils/pagination.js';
import * as maintenanceService from '../services/maintenanceMode.service.js';
import * as avatarService from '../services/platformAdminAvatar.service.js';

export const login = asyncHandler(async (req, res) => {
  const result = await platformAdminService.loginPlatformAdmin(req.body, req);
  sendSuccess(res, { data: result });
});

export const logout = asyncHandler(async (req, res) => {
  await platformAdminService.logoutPlatformAdmin(req);
  sendSuccess(res, { data: { loggedOut: true } });
});

export const me = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: req.platformAdmin });
});

export const overview = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await platformAdminService.getOverviewForPlatformAdmin() });
});

export const getOrganization = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await platformAdminService.getOrganizationDetailForPlatformAdmin(req.params.id) });
});

export const updateOrganization = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await platformAdminService.updateOrganizationByPlatformAdmin(req.params.id, req.body, req.platformAdmin, req), message: 'Organization updated.' });
});

export const sendOrganizationAdminReset = asyncHandler(async (req, res) => {
  const result = await platformAdminService.sendOrganizationAdminPasswordReset(req.params.id, req.body.userId, req.platformAdmin, req);
  sendSuccess(res, { data: result, message: 'Password reset link sent.' });
});

// ── Password reset + own account ──

export const forgotPassword = asyncHandler(async (req, res) => {
  const result = await accountService.requestPasswordReset(req.body.email);
  sendSuccess(res, { data: null, message: result.message });
});

export const resetPassword = asyncHandler(async (req, res) => {
  await accountService.resetPasswordWithToken(req.body);
  sendSuccess(res, { data: null, message: 'Password updated. You can now sign in.' });
});

export const changePassword = asyncHandler(async (req, res) => {
  await accountService.changeOwnPassword(req.platformAdmin.id, req.body, req.platformAdmin, req);
  sendSuccess(res, { data: null, message: 'Password changed successfully.' });
});

export const updateProfile = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await accountService.updateOwnProfile(req.platformAdmin.id, req.body), message: 'Profile updated.' });
});

// ── Other platform admins ──

export const listAdmins = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await accountService.listPlatformAdmins() });
});

export const createAdmin = asyncHandler(async (req, res) => {
  const admin = await accountService.createPlatformAdminByAdmin(req.body, req.platformAdmin.id, req.platformAdmin, req);
  sendSuccess(res, { statusCode: 201, data: admin, message: 'Platform admin added and invited by email.' });
});

export const setAdminStatus = asyncHandler(async (req, res) => {
  const admin = await accountService.setPlatformAdminActive(req.params.id, req.body.isActive, req.platformAdmin.id, req.platformAdmin, req);
  sendSuccess(res, { data: admin });
});

export const listOrganizations = asyncHandler(async (req, res) => {
  const organizations = await platformAdminService.listOrganizationsForPlatformAdmin();
  sendSuccess(res, { data: organizations });
});

export const createOrganization = asyncHandler(async (req, res) => {
  const result = await platformAdminService.createOrganizationByPlatformAdmin({
    ...req.body,
    logoFile: req.file,
  }, req.platformAdmin, req);
  sendSuccess(res, { statusCode: 201, data: result, message: 'Organization created and administrator notified by email.' });
});

export const setOrganizationStatus = asyncHandler(async (req, res) => {
  const organization = await platformAdminService.setOrganizationStatusByPlatformAdmin(req.params.id, req.body.status, req.platformAdmin, req);
  sendSuccess(res, { data: organization });
});

export const deleteAdmin = asyncHandler(async (req, res) => {
  await accountService.deletePlatformAdmin(req.params.id, req.platformAdmin.id, req.platformAdmin, req);
  sendSuccess(res, { data: null, message: 'Platform admin deleted.' });
});

export const replaceOrganizationLogo = asyncHandler(async (req, res) => {
  const organization = await platformAdminService.replaceOrganizationLogoByPlatformAdmin(req.params.id, req.file, req.platformAdmin, req);
  sendSuccess(res, { data: organization, message: 'Logo updated.' });
});

export const listAuditLogs = asyncHandler(async (req, res) => {
  const { page, pageSize, skip, take } = parsePagination(req.query);
  const result = await listPlatformAuditLogs({ page, pageSize, skip, take, action: req.query.action || undefined, search: req.query.search || undefined });
  sendSuccess(res, { data: { logs: result.logs, actions: result.actions }, meta: result.meta });
});

export const getMaintenance = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: { ...(await maintenanceService.getMaintenance()), pageGroups: maintenanceService.MAINTENANCE_PAGE_GROUPS } });
});

export const setMaintenance = asyncHandler(async (req, res) => {
  const data = await maintenanceService.setMaintenance(req.body, req.platformAdmin, req);
  sendSuccess(res, { data, message: data.enabled ? 'Maintenance mode is on.' : 'Maintenance mode is off.' });
});

export const uploadAvatar = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await avatarService.setAvatar(req.platformAdmin, req.file, req), message: 'Profile picture updated.' });
});

export const removeAvatar = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await avatarService.removeAvatar(req.platformAdmin, req), message: 'Profile picture removed.' });
});

// Any signed-in platform admin may see another's picture (it appears next to
// their name in lists). Served with the stored, sniffed type and nosniff.
export const getAvatar = asyncHandler(async (req, res) => {
  const { mimeType, data } = await avatarService.getAvatar(req.params.id);
  res.setHeader('Content-Type', mimeType);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, max-age=86400');
  res.send(data);
});
