import { prisma } from '../config/database.js';
import { logger } from '../config/logger.js';
import { destroyCloudinaryAsset } from '../integrations/cloudinary/uploadService.js';

// Deleting a record also deletes the files attached to it, so nothing
// orphaned is left behind in the database or in storage.
export async function deleteDocumentsFor(organizationId, entityType, entityId) {
  const docs = await prisma.document.findMany({ where: { organizationId, entityType, entityId } });
  if (docs.length === 0) return;
  await prisma.document.deleteMany({ where: { id: { in: docs.map((d) => d.id) } } });
  for (const d of docs) {
    await destroyCloudinaryAsset({ publicId: d.cloudinaryPublicId, resourceType: d.cloudinaryResourceType })
      .catch((err) => logger.error({ err }, 'failed to remove a deleted record\'s stored file'));
  }
}
