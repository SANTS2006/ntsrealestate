import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import * as organizationService from '../services/organization.service.js';

export const getMyOrganization = asyncHandler(async (req, res) => {
  const organization = await organizationService.getMyOrganization(req.user.organizationId);
  sendSuccess(res, { data: organization });
});

export const getMyOrganizationBranding = asyncHandler(async (req, res) => {
  const branding = await organizationService.getMyOrganizationBranding(req.user.organizationId);
  sendSuccess(res, { data: branding });
});

export const updateMyOrganization = asyncHandler(async (req, res) => {
  const organization = await organizationService.updateMyOrganization(req.user.organizationId, req.body, req.user, req);
  sendSuccess(res, { data: organization, message: 'Organization updated.' });
});
