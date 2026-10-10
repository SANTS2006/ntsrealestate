import { Router } from 'express';
import { authRateLimiter } from '../../middleware/security.js';
import { csrfProtection } from '../../middleware/csrf.js';
import { resolveTenantOrg } from '../../middleware/resolveTenantOrg.js';
import { validate } from '../../middleware/validate.js';
import * as tenantAuthController from '../../controllers/tenantAuth.controller.js';
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } from '../../validators/auth.validators.js';

// Mounted at /orgs/:orgSlug (see routes/v1/index.js) with mergeParams, so
// `req.params.orgSlug` is available in every route below even though it's
// defined on the parent mount path, not here.
export const tenantAuthRouter = Router({ mergeParams: true });

tenantAuthRouter.get('/branding', tenantAuthController.getBranding);

tenantAuthRouter.post('/auth/register', authRateLimiter(), csrfProtection, resolveTenantOrg, validate(registerSchema), tenantAuthController.register);
tenantAuthRouter.post('/auth/login', authRateLimiter(), csrfProtection, resolveTenantOrg, validate(loginSchema), tenantAuthController.login);
tenantAuthRouter.post('/auth/forgot-password', authRateLimiter(), csrfProtection, resolveTenantOrg, validate(forgotPasswordSchema), tenantAuthController.forgotPassword);
tenantAuthRouter.post('/auth/reset-password', authRateLimiter(), csrfProtection, resolveTenantOrg, validate(resetPasswordSchema), tenantAuthController.resetPassword);
