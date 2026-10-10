import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { findPlatformAdminById } from '../repositories/platformAdmin.repository.js';

// Structurally separate from `authenticate` (middleware/auth.js) — reads
// only `req.session.platformAdminId`, never `req.session.userId`, and
// attaches `req.platformAdmin` rather than `req.user`. A tenant session and
// a platform-admin session share the same cookie/store (connect-pg-simple),
// but the two identity keys are never read by each other's middleware, so
// neither can be mistaken for the other regardless of which is present.
export const authenticatePlatformAdmin = asyncHandler(async (req, res, next) => {
  if (!req.session?.platformAdminId) throw AppError.unauthorized();

  const admin = await findPlatformAdminById(req.session.platformAdminId);
  if (!admin) {
    return req.session.destroy(() => next(AppError.unauthorized('Your session is no longer valid. Please sign in again.')));
  }
  if (!admin.isActive) {
    return req.session.destroy(() => next(AppError.forbidden('Your account has been deactivated. Please contact the platform administrator.')));
  }

  req.platformAdmin = { id: admin.id, email: admin.email, firstName: admin.firstName, lastName: admin.lastName };
  next();
});
