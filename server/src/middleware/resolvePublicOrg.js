import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { findOrganizationBySlug } from '../repositories/organization.repository.js';
import { normalizeSlug } from '../utils/slug.js';
import { env } from '../config/env.js';

// Public (unauthenticated) endpoints serve exactly one company's data, chosen
// by the URL name in the path (/public/orgs/acme-realty/listings) — that is
// the ONLY thing deciding whose data is returned, so one company's site can
// never read another's. A missing or deactivated company is a plain 404.
// The un-slugged legacy routes fall back to PRIMARY_ORGANIZATION_ID if set.
export const resolvePublicOrg = asyncHandler(async (req, res, next) => {
  if (req.params.orgSlug) {
    const organization = await findOrganizationBySlug(normalizeSlug(req.params.orgSlug));
    if (!organization || organization.status !== 'active') throw AppError.notFound('Not found.');
    req.publicOrgId = organization.id;
    return next();
  }
  if (!env.PRIMARY_ORGANIZATION_ID) throw AppError.notFound('Not found.');
  req.publicOrgId = env.PRIMARY_ORGANIZATION_ID;
  return next();
});
