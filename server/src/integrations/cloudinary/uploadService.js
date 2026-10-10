import { randomUUID } from 'node:crypto';
import { cloudinary, assertCloudinaryConfigured } from './client.js';
import { AppError } from '../../utils/AppError.js';
import { logger } from '../../config/logger.js';

// Folder path is built entirely from trusted, server-derived context
// (organizationId from the authenticated principal, entityType/entityId
// already verified to belong to that organization by the caller) — never
// from a client-supplied path string. See docs/security/cloudinary-security.md
// section 3.
function buildFolder(organizationId, entityType, entityId) {
  return `real-estate/organizations/${organizationId}/${entityType}/${entityId}`;
}

// Every asset is uploaded as Cloudinary's `authenticated` delivery type -
// the raw delivery URL is inert without a valid signature, so even a
// leaked/guessed public_id grants nothing. There is currently no "public
// asset" category (e.g. a genuinely public org logo); everything goes
// through the signed access-url flow in document.service.js.
export async function uploadToCloudinary(buffer, { organizationId, entityType, entityId, resourceType, safeFilename }) {
  assertCloudinaryConfigured();

  const folder = buildFolder(organizationId, entityType, entityId);
  const publicId = `${randomUUID()}-${safeFilename}`;

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId,
        resource_type: resourceType,
        type: 'authenticated',
        use_filename: false,
        unique_filename: false,
        overwrite: false,
      },
      (error, result) => {
        if (error) return reject(AppError.internal('File upload failed. Please try again.'));
        resolve(result);
      }
    );
    uploadStream.end(buffer);
  });
}

// Time-boxed signed URL for a private/authenticated asset - the client
// never receives a permanent, cacheable link. `expiresInSeconds` is kept
// short (see document.service.js) since a new one can always be requested
// through the (re-authorized) access-url endpoint.
export function generateSignedAccessUrl({ publicId, resourceType }, expiresInSeconds = 300) {
  assertCloudinaryConfigured();
  const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const url = cloudinary.utils.private_download_url(publicId, undefined, {
    resource_type: resourceType,
    type: 'authenticated',
    expires_at: expiresAt,
  });
  return { url, expiresAt: new Date(expiresAt * 1000) };
}

export async function destroyCloudinaryAsset({ publicId, resourceType }) {
  assertCloudinaryConfigured();
  try {
    const result = await cloudinary.uploader.destroy(publicId, { resource_type: resourceType, type: 'authenticated' });
    return result.result === 'ok' || result.result === 'not found';
  } catch (err) {
    logger.error({ err, publicId }, 'Cloudinary asset deletion failed');
    return false;
  }
}
