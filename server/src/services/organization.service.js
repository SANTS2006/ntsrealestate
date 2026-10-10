import { AppError } from '../utils/AppError.js';
import { findOrganizationById, updateOrganization } from '../repositories/organization.repository.js';
import { audit } from './audit.service.js';
import { prisma } from '../config/database.js';
import { generateSignedAccessUrl } from '../integrations/cloudinary/uploadService.js';

const LOGO_URL_TTL_SECONDS = 60 * 60;

// The branding subset only (name, logo, colors) — every authenticated
// caller regardless of role needs this to render the dashboard shell (see
// routes/v1/organizations.routes.js for why this has no permission gate),
// unlike getMyOrganization below which returns the full record.
export async function getMyOrganizationBranding(organizationId) {
  const organization = await findOrganizationById(organizationId);
  if (!organization) throw AppError.notFound('Organization not found.');

  let logoUrl = null;
  if (organization.logoDocumentId) {
    const doc = await prisma.document.findUnique({ where: { id: organization.logoDocumentId } });
    if (doc) logoUrl = generateSignedAccessUrl({ publicId: doc.cloudinaryPublicId, resourceType: doc.cloudinaryResourceType }, LOGO_URL_TTL_SECONDS).url;
  }

  return {
    name: organization.name,
    slug: organization.slug,
    primaryColor: organization.primaryColor,
    secondaryColor: organization.secondaryColor,
    logoUrl,
  };
}

// The caller's own organizationId (from req.user, itself derived from the
// authenticated session/token — never from a route param) is the only
// organization this ever touches. There is no "get organization by
// arbitrary id" here; that would be a cross-tenant IDOR by construction.
export async function getMyOrganization(organizationId) {
  const organization = await findOrganizationById(organizationId);
  if (!organization) throw AppError.notFound('Organization not found.');
  return organization;
}

const UPDATABLE_FIELDS = ['name', 'legalName', 'registrationNumber', 'phone', 'address', 'city', 'region', 'country', 'settings'];

export async function updateMyOrganization(organizationId, body, actingUser, req) {
  const before = await findOrganizationById(organizationId);
  if (!before) throw AppError.notFound('Organization not found.');

  const data = {};
  for (const field of UPDATABLE_FIELDS) {
    if (body[field] !== undefined) data[field] = body[field];
  }

  const updated = await updateOrganization(organizationId, data);

  await audit({
    organizationId, userId: actingUser.id, action: 'organization.settings_updated', entityType: 'organization', entityId: organizationId,
    oldValues: Object.fromEntries(UPDATABLE_FIELDS.filter((f) => f in data).map((f) => [f, before[f]])),
    newValues: data,
    req,
  });

  return updated;
}
