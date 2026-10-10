import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { authenticate } from './auth.js';
import { authenticatePlatformAdmin } from './platformAdminAuth.js';

// Chat is used by two kinds of signed-in person: organization users and
// platform admins (who talk to organization administrators). Whichever
// session is present is fully re-validated by that kind's own middleware,
// then normalized into req.chatActor.
export const authenticateChatActor = asyncHandler(async (req, res, next) => {
  if (req.session?.platformAdminId && !req.session?.userId) {
    return authenticatePlatformAdmin(req, res, (err) => {
      if (err) return next(err);
      req.chatActor = { kind: 'platform', id: req.platformAdmin.id };
      return next();
    });
  }
  if (req.session?.userId) {
    return authenticate(req, res, (err) => {
      if (err) return next(err);
      req.chatActor = { kind: 'user', id: req.user.id, organizationId: req.user.organizationId, roles: req.user.roles };
      return next();
    });
  }
  throw AppError.unauthorized();
});
