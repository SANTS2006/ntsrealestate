import { AppError } from '../utils/AppError.js';
import { buildPaginationMeta } from '../utils/pagination.js';
import { validateUploadedFile } from '../integrations/cloudinary/fileValidation.js';
import { uploadToCloudinary, generateSignedAccessUrl, destroyCloudinaryAsset } from '../integrations/cloudinary/uploadService.js';
import { entityBelongsToOrganization, isKnownEntityType } from './documentEntityResolver.js';
import {
  createDocument, findDocumentById, findDocumentsByEntity, countDocumentsByEntity,
  findLatestImageDocumentsByEntityIds, setDocumentStatus, deleteDocumentRow,
} from '../repositories/document.repository.js';
import { audit } from './audit.service.js';
import { logger } from '../config/logger.js';

const ACCESS_URL_TTL_SECONDS = 5 * 60;
const COVER_IMAGE_TTL_SECONDS = 5 * 60;

// Batch "cover photo" lookup shared by every list endpoint that shows a
// thumbnail per row (properties, buildings, units, tenants, owners) —
// newest active image document per entity, signed once here so callers
// never touch Cloudinary details directly. Returns a Map keyed by entityId;
// entities with no image simply have no key (callers default to null).
export async function getCoverImageUrls(organizationId, entityType, entityIds) {
  const map = new Map();
  if (entityIds.length === 0) return map;

  const docs = await findLatestImageDocumentsByEntityIds(organizationId, entityType, entityIds);
  for (const doc of docs) {
    if (map.has(doc.entityId)) continue; // rows are newest-first; keep the first (most recent) per entity
    map.set(doc.entityId, generateSignedAccessUrl({ publicId: doc.cloudinaryPublicId, resourceType: doc.cloudinaryResourceType }, COVER_IMAGE_TTL_SECONDS).url);
  }
  return map;
}

function serializeDocument(doc) {
  return {
    id: doc.id,
    entityType: doc.entityType,
    entityId: doc.entityId,
    originalFilename: doc.originalFilename,
    mimeType: doc.mimeType,
    fileSize: doc.fileSize,
    status: doc.status,
    uploadedBy: doc.uploadedBy,
    createdAt: doc.createdAt,
  };
}

// Full flow: authorization for the *target entity* -> file validation
// (magic bytes, not just extension/declared type) -> Cloudinary upload ->
// metadata row. See docs/architecture/system-architecture.md section 4.
export async function uploadDocument({ organizationId, entityType, entityId, actingUser, file }, req) {
  if (!isKnownEntityType(entityType)) {
    throw AppError.badRequest(`Uploads for entity type "${entityType}" are not yet supported.`);
  }
  const belongsToOrg = await entityBelongsToOrganization(entityType, entityId, organizationId, actingUser);
  if (!belongsToOrg) {
    // 404, not 403 - never confirm whether a cross-org entity id exists.
    throw AppError.notFound('The target record for this upload could not be found.');
  }

  const { resourceType, mimeType, safeFilename } = await validateUploadedFile(file.buffer, file.originalname, file.mimetype);

  const uploadResult = await uploadToCloudinary(file.buffer, { organizationId, entityType, entityId, resourceType, safeFilename });

  let document;
  try {
    document = await createDocument({
      organizationId,
      entityType,
      entityId,
      cloudinaryPublicId: uploadResult.public_id,
      cloudinaryResourceType: uploadResult.resource_type,
      cloudinaryAssetType: 'authenticated',
      originalFilename: safeFilename,
      mimeType,
      fileSize: uploadResult.bytes,
      uploadedBy: actingUser.id,
      status: 'active',
    });
  } catch (err) {
    // The Cloudinary asset was created but the metadata row failed - clean
    // up immediately rather than leaving an orphan with no DB record ever
    // pointing at it (see docs/security/cloudinary-security.md section 5).
    await destroyCloudinaryAsset({ publicId: uploadResult.public_id, resourceType: uploadResult.resource_type });
    throw err;
  }

  await audit({
    organizationId, userId: actingUser.id, action: 'document.upload', entityType: 'document', entityId: document.id,
    newValues: { entityType, entityId, originalFilename: safeFilename, fileSize: document.fileSize }, req,
  });

  return serializeDocument(document);
}

// `documents:read` alone is necessarily an org-wide grant (permissions
// don't carry per-row scope) — so listing still has to re-check that the
// caller may actually see *this* entityType/entityId, the same way upload
// does. A property_manager holding `documents:read` must not be able to
// list documents for a property they aren't assigned to just by passing
// its id in the query string.
export async function listDocuments(organizationId, entityType, entityId, actingUser, { page, pageSize, skip, take }) {
  if (!isKnownEntityType(entityType)) {
    throw AppError.badRequest(`Documents for entity type "${entityType}" are not yet supported.`);
  }
  const belongsToOrg = await entityBelongsToOrganization(entityType, entityId, organizationId, actingUser);
  if (!belongsToOrg) throw AppError.notFound('The requested record could not be found.');

  const [documents, total] = await Promise.all([
    findDocumentsByEntity(organizationId, entityType, entityId, { skip, take }),
    countDocumentsByEntity(organizationId, entityType, entityId),
  ]);
  return { documents: documents.map(serializeDocument), meta: buildPaginationMeta({ page, pageSize, total }) };
}

// Authorization -> load the specific row (org-scoped) -> re-check access to
// the *entity the document is attached to* (not just the document row's own
// organization) -> only then generate a short-lived signed URL. Changing
// `/documents/123` to `/documents/124` re-runs this whole chain against
// whatever row 124 actually is; a cross-org OR cross-assignment mismatch is
// a 404 here exactly like everywhere else in the codebase.
export async function getDocumentAccessUrl(documentId, organizationId, actingUser, req) {
  const document = await findDocumentById(documentId, organizationId);
  if (!document || !['active', 'archived'].includes(document.status)) {
    throw AppError.notFound('Document not found.');
  }
  const belongsToOrg = await entityBelongsToOrganization(document.entityType, document.entityId, organizationId, actingUser);
  if (!belongsToOrg) throw AppError.notFound('Document not found.');

  const { url, expiresAt } = generateSignedAccessUrl({
    publicId: document.cloudinaryPublicId,
    resourceType: document.cloudinaryResourceType,
  }, ACCESS_URL_TTL_SECONDS);

  await audit({
    organizationId, userId: actingUser.id, action: 'document.access', entityType: 'document', entityId: document.id, req,
  });

  return { url, expiresAt };
}

export async function deleteDocument(documentId, organizationId, actingUser, req) {
  const document = await findDocumentById(documentId, organizationId);
  if (!document) throw AppError.notFound('Document not found.');
  const belongsToOrg = await entityBelongsToOrganization(document.entityType, document.entityId, organizationId, actingUser);
  if (!belongsToOrg) throw AppError.notFound('Document not found.');

  const cleanedUp = await destroyCloudinaryAsset({ publicId: document.cloudinaryPublicId, resourceType: document.cloudinaryResourceType });

  if (cleanedUp) {
    await deleteDocumentRow(document.id);
  } else {
    // Never silently drop this - the row is kept in a known-bad state so
    // it can be retried, and it's already excluded from every listing/
    // access-url query since those only match active/archived status.
    await setDocumentStatus(document.id, 'deletion_failed');
    logger.error({ documentId: document.id }, 'Cloudinary cleanup failed on document delete - marked for retry');
  }

  await audit({
    organizationId, userId: actingUser.id, action: 'document.delete', entityType: 'document', entityId: document.id,
    newValues: { cloudinaryCleanupSucceeded: cleanedUp }, req,
  });

  return { deleted: true };
}
