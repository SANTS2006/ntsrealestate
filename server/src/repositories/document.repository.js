import { prisma } from '../config/database.js';

export function createDocument(data) {
  return prisma.document.create({ data });
}

export function findDocumentById(id, organizationId) {
  return prisma.document.findFirst({ where: { id, organizationId } });
}

export function findDocumentsByEntity(organizationId, entityType, entityId, { skip, take }) {
  return prisma.document.findMany({
    where: { organizationId, entityType, entityId, status: { in: ['active', 'archived'] } },
    orderBy: { createdAt: 'desc' },
    skip,
    take,
  });
}

export function countDocumentsByEntity(organizationId, entityType, entityId) {
  return prisma.document.count({
    where: { organizationId, entityType, entityId, status: { in: ['active', 'archived'] } },
  });
}

// Batch lookup for list-page cover images: newest active image document per
// entity, in one round trip instead of N+1. Callers pick the first row per
// entityId in JS (small result sets - one candidate row per requested id at
// most times what's returned here, since only images are selected).
export function findLatestImageDocumentsByEntityIds(organizationId, entityType, entityIds) {
  if (entityIds.length === 0) return Promise.resolve([]);
  return prisma.document.findMany({
    where: {
      organizationId,
      entityType,
      entityId: { in: entityIds },
      status: { in: ['active', 'archived'] },
      mimeType: { startsWith: 'image/' },
    },
    orderBy: { createdAt: 'desc' },
    select: { entityId: true, cloudinaryPublicId: true, cloudinaryResourceType: true },
  });
}

export function setDocumentStatus(id, status) {
  return prisma.document.update({ where: { id }, data: { status } });
}

// Deleting the row entirely is only reached after the Cloudinary asset has
// already been destroyed - see document.service.js. If cleanup fails, the
// row is kept (status: deletion_failed) rather than removed, so nothing
// ever points at an orphaned or already-gone Cloudinary asset silently.
export function deleteDocumentRow(id) {
  return prisma.document.delete({ where: { id } });
}
