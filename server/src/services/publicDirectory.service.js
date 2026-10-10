import { prisma } from '../config/database.js';
import { generateSignedAccessUrl } from '../integrations/cloudinary/uploadService.js';

const LOGO_URL_TTL_SECONDS = 60 * 60;

// The companies shown on the platform's home page: name, URL name (slug) for
// the sign-in link, brand colour and a signed logo link. Nothing else about
// an organization is exposed, and suspended/cancelled ones are left out.
export async function listPublicOrganizations() {
  const orgs = await prisma.organization.findMany({
    where: { status: 'active' },
    select: { name: true, slug: true, primaryColor: true, logoDocumentId: true },
    orderBy: { name: 'asc' },
  });
  const logoIds = orgs.map((o) => o.logoDocumentId).filter(Boolean);
  const docs = logoIds.length
    ? await prisma.document.findMany({ where: { id: { in: logoIds } }, select: { id: true, cloudinaryPublicId: true, cloudinaryResourceType: true } })
    : [];
  const docById = new Map(docs.map((d) => [d.id, d]));

  return orgs.map((o) => {
    const doc = o.logoDocumentId ? docById.get(o.logoDocumentId) : null;
    return {
      name: o.name,
      slug: o.slug,
      primaryColor: o.primaryColor,
      logoUrl: doc ? generateSignedAccessUrl({ publicId: doc.cloudinaryPublicId, resourceType: doc.cloudinaryResourceType }, LOGO_URL_TTL_SECONDS).url : null,
    };
  });
}
