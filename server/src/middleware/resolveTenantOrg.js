import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { normalizeSlug } from '../utils/slug.js';
import { findOrganizationBySlug } from '../repositories/organization.repository.js';

// Resolves the `:orgSlug` URL segment (e.g. /orgs/acme-realty/auth/login)
// to a real Organization and attaches it as `req.tenantOrg` for every
// route nested under it. Deliberately does NOT reject a suspended
// organization here — the branding endpoint has to keep working for a
// suspended org so its branded login page can render the "deactivated,
// contact the platform admin" message; the actual access block happens in
// auth.service.js's login/registerOrganization, which check
// req.tenantOrg.status themselves. A slug that resolves to nothing is a
// plain 404 either way — there's no tenant data to protect by hiding that.
export const resolveTenantOrg = asyncHandler(async (req, res, next) => {
  const organization = await findOrganizationBySlug(normalizeSlug(req.params.orgSlug));
  if (!organization) throw AppError.notFound('This organization could not be found.');
  req.tenantOrg = organization;
  next();
});
