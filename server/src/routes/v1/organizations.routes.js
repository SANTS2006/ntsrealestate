import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/authorize.js';
import { csrfProtection } from '../../middleware/csrf.js';
import { validate } from '../../middleware/validate.js';
import * as organizationController from '../../controllers/organization.controller.js';
import { updateOrganizationSchema } from '../../validators/organization.validators.js';

export const organizationsRouter = Router();

organizationsRouter.use(authenticate);

// No permission gate, deliberately — every authenticated caller regardless
// of role (a tenant included) needs their own organization's name/logo/
// colors to render the dashboard shell consistently. Returns only that
// branding subset, never the full organization record (legal name,
// registration number, etc.), which stays behind `organizations:read` below.
organizationsRouter.get('/me/branding', organizationController.getMyOrganizationBranding);

// Scoped to the caller's own organization only — there is no "get
// organization by id" route, which would otherwise need its own IDOR check
// for every caller. See services/organization.service.js.
organizationsRouter.get('/me', requirePermission('organizations:read'), organizationController.getMyOrganization);
organizationsRouter.patch('/me', csrfProtection, requirePermission('organizations:update'), validate(updateOrganizationSchema), organizationController.updateMyOrganization);
