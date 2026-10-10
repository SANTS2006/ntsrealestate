import { v2 as cloudinary } from 'cloudinary';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';

export const cloudinaryConfigured = Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);

if (cloudinaryConfigured) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET, // server-side only — never reaches the client, see docs/security/cloudinary-security.md
    secure: true,
  });
}

// Called at the top of every operation that actually needs Cloudinary, so a
// missing configuration fails with a clear, actionable error rather than a
// confusing SDK-level exception deep in an upload call.
export function assertCloudinaryConfigured() {
  if (!cloudinaryConfigured) {
    throw AppError.internal('File storage is not configured on this server. Set CLOUDINARY_CLOUD_NAME/CLOUDINARY_API_KEY/CLOUDINARY_API_SECRET.');
  }
}

export { cloudinary };
