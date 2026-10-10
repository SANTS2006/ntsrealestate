import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import * as authService from '../services/auth.service.js';
import { getOrganizationBrandingBySlug } from '../services/platformAdmin.service.js';

// The one endpoint a tenant's branded auth pages can call before knowing
// anything else — the frontend fetches this first to render the right
// logo/name/colors, then renders the actual login/register/forgot-password
// form. See platformAdmin.service.js#getOrganizationBrandingBySlug for why
// this stays safe to call for a suspended org too.
export const getBranding = asyncHandler(async (req, res) => {
  const branding = await getOrganizationBrandingBySlug(req.params.orgSlug);
  sendSuccess(res, { data: branding });
});

export const register = asyncHandler(async (req, res) => {
  const result = await authService.registerOrganization(req.body, req.tenantOrg, req);
  sendSuccess(res, {
    statusCode: 201,
    data: result,
    message: 'Account created. Please check your email to verify your address before signing in.',
  });
});

export const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body, req.tenantOrg, req);
  if (result.mfaRequired) {
    return sendSuccess(res, { data: { mfaRequired: true, mfaToken: result.mfaToken }, message: 'Multi-factor authentication code required.' });
  }
  sendSuccess(res, { data: result, message: 'Signed in successfully.' });
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const result = await authService.forgotPassword(req.body.email, req.tenantOrg, req);
  sendSuccess(res, { data: null, message: result.message });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const result = await authService.resetPassword(req.body, req);
  sendSuccess(res, { data: result, message: 'Password reset successfully. You can now sign in.' });
});
