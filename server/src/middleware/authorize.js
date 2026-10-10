import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { getEffectivePermissions } from '../services/authorization.service.js';

// Steps 1–3 of the authorization formula in docs/security/authorization.md
// (auth → org scope → role/permission). Steps 4–6 (ownership/assignment,
// resource state) are enforced in the service layer once the specific
// resource row is loaded, because they need the row in hand — this
// middleware only ever runs *before* a controller/service has fetched
// anything. Requires `authenticate` to have already populated req.user.
export function requirePermission(permissionName) {
  return asyncHandler(async (req, res, next) => {
    if (!req.user) throw AppError.unauthorized();

    const permissions = await getEffectivePermissions(req.user.organizationId, req.user.roles);
    if (!permissions.has(permissionName)) {
      throw AppError.forbidden(`You do not have the "${permissionName}" permission required for this action.`);
    }

    // Available to the rest of the request (e.g. a controller deciding
    // whether to include admin-only fields) without a second DB round trip.
    req.permissions = permissions;
    next();
  });
}

// Passes if the caller holds ANY of the given permissions — useful where
// more than one role could legitimately reach an endpoint (e.g. a report
// readable by both `reports:read` and an owner-specific variant added
// later).
export function requireAnyPermission(permissionNames) {
  return asyncHandler(async (req, res, next) => {
    if (!req.user) throw AppError.unauthorized();

    const permissions = await getEffectivePermissions(req.user.organizationId, req.user.roles);
    if (!permissionNames.some((name) => permissions.has(name))) {
      throw AppError.forbidden('You do not have permission to perform this action.');
    }

    req.permissions = permissions;
    next();
  });
}
