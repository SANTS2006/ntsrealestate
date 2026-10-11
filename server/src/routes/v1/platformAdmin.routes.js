import { Router } from 'express';
import { authRateLimiter } from '../../middleware/security.js';
import { csrfProtection } from '../../middleware/csrf.js';
import { authenticatePlatformAdmin } from '../../middleware/platformAdminAuth.js';
import { singleFileUpload, limitedFileUpload } from '../../middleware/upload.js';
import { validate } from '../../middleware/validate.js';
import * as platformAdminController from '../../controllers/platformAdmin.controller.js';
import { mfaChallengeSchema, mfaConfirmSchema, mfaDisableSchema } from '../../validators/auth.validators.js';
import * as backupController from '../../controllers/backup.controller.js';
import { listBackupsSchema, listRestoresSchema, backupIdSchema, policySchema, prepareRestoreSchema, startRestoreSchema } from '../../validators/backup.validators.js';
import {
  platformAdminLoginSchema, createOrganizationSchema, organizationStatusSchema, platformForgotPasswordSchema,
  platformResetPasswordSchema, platformChangePasswordSchema, platformProfileSchema, createPlatformAdminSchema,
  platformAdminStatusSchema, organizationIdParamSchema, updateOrganizationSchema, sendAdminResetSchema, maintenanceSchema,
} from '../../validators/platformAdmin.validators.js';

export const platformAdminRouter = Router();

platformAdminRouter.post('/auth/login', authRateLimiter(), csrfProtection, validate(platformAdminLoginSchema), platformAdminController.login);
platformAdminRouter.post('/auth/logout', csrfProtection, authenticatePlatformAdmin, platformAdminController.logout);
platformAdminRouter.get('/auth/me', authenticatePlatformAdmin, platformAdminController.me);
platformAdminRouter.post('/auth/forgot-password', authRateLimiter(), csrfProtection, validate(platformForgotPasswordSchema), platformAdminController.forgotPassword);
platformAdminRouter.post('/auth/reset-password', authRateLimiter(), csrfProtection, validate(platformResetPasswordSchema), platformAdminController.resetPassword);
platformAdminRouter.post('/auth/change-password', authRateLimiter(), authenticatePlatformAdmin, csrfProtection, validate(platformChangePasswordSchema), platformAdminController.changePassword);
platformAdminRouter.patch('/auth/profile', authenticatePlatformAdmin, csrfProtection, validate(platformProfileSchema), platformAdminController.updateProfile);

platformAdminRouter.post('/auth/mfa/challenge', authRateLimiter(), csrfProtection, validate(mfaChallengeSchema), platformAdminController.mfaChallenge);
platformAdminRouter.post('/auth/mfa/enroll', authenticatePlatformAdmin, csrfProtection, platformAdminController.mfaEnroll);
platformAdminRouter.post('/auth/mfa/confirm', authRateLimiter(), authenticatePlatformAdmin, csrfProtection, validate(mfaConfirmSchema), platformAdminController.mfaConfirm);
platformAdminRouter.post('/auth/mfa/disable', authRateLimiter(), authenticatePlatformAdmin, csrfProtection, validate(mfaDisableSchema), platformAdminController.mfaDisable);
platformAdminRouter.post('/admins/:id/mfa/reset', authenticatePlatformAdmin, csrfProtection, validate(organizationIdParamSchema), platformAdminController.mfaReset);
platformAdminRouter.post('/auth/avatar', authenticatePlatformAdmin, csrfProtection, limitedFileUpload('avatar', 2 * 1024 * 1024), platformAdminController.uploadAvatar);
platformAdminRouter.delete('/auth/avatar', authenticatePlatformAdmin, csrfProtection, platformAdminController.removeAvatar);
platformAdminRouter.get('/admins/:id/avatar', authenticatePlatformAdmin, validate(organizationIdParamSchema), platformAdminController.getAvatar);

platformAdminRouter.get('/maintenance', authenticatePlatformAdmin, platformAdminController.getMaintenance);
platformAdminRouter.put('/maintenance', authenticatePlatformAdmin, csrfProtection, validate(maintenanceSchema), platformAdminController.setMaintenance);

platformAdminRouter.get('/overview', authenticatePlatformAdmin, platformAdminController.overview);

platformAdminRouter.get('/admins', authenticatePlatformAdmin, platformAdminController.listAdmins);
platformAdminRouter.post('/admins', authenticatePlatformAdmin, csrfProtection, validate(createPlatformAdminSchema), platformAdminController.createAdmin);
platformAdminRouter.delete('/admins/:id', authenticatePlatformAdmin, csrfProtection, validate(organizationIdParamSchema), platformAdminController.deleteAdmin);
platformAdminRouter.get('/audit-logs', authenticatePlatformAdmin, platformAdminController.listAuditLogs);
platformAdminRouter.patch('/admins/:id/status', authenticatePlatformAdmin, csrfProtection, validate(platformAdminStatusSchema), platformAdminController.setAdminStatus);

platformAdminRouter.get('/organizations', authenticatePlatformAdmin, platformAdminController.listOrganizations);
platformAdminRouter.post(
  '/organizations',
  authenticatePlatformAdmin,
  csrfProtection,
  singleFileUpload('logo'),
  validate(createOrganizationSchema),
  platformAdminController.createOrganization
);
platformAdminRouter.get('/organizations/:id', authenticatePlatformAdmin, validate(organizationIdParamSchema), platformAdminController.getOrganization);
platformAdminRouter.patch('/organizations/:id', authenticatePlatformAdmin, csrfProtection, validate(updateOrganizationSchema), platformAdminController.updateOrganization);
platformAdminRouter.post('/organizations/:id/logo', authenticatePlatformAdmin, csrfProtection, singleFileUpload('logo'), validate(organizationIdParamSchema), platformAdminController.replaceOrganizationLogo);
platformAdminRouter.post('/organizations/:id/send-admin-reset', authenticatePlatformAdmin, csrfProtection, validate(sendAdminResetSchema), platformAdminController.sendOrganizationAdminReset);
platformAdminRouter.patch(
  '/organizations/:id/status',
  authenticatePlatformAdmin,
  csrfProtection,
  validate(organizationStatusSchema),
  platformAdminController.setOrganizationStatus
);

// ── Backup & Recovery ────────────────────────────────────────────────────
// Static paths first so ":id" never swallows them. Every route needs a
// signed-in platform admin; a restore additionally needs the password again.
const backupLimiter = authRateLimiter(30);
platformAdminRouter.get('/backups/status', authenticatePlatformAdmin, backupController.status);
platformAdminRouter.get('/backups/policy', authenticatePlatformAdmin, backupController.getPolicy);
platformAdminRouter.put('/backups/policy', authenticatePlatformAdmin, csrfProtection, validate(policySchema), backupController.setPolicy);
platformAdminRouter.get('/backups/restores', authenticatePlatformAdmin, validate(listRestoresSchema), backupController.listRestores);
platformAdminRouter.post('/backups/restores/prepare', authenticatePlatformAdmin, csrfProtection, backupLimiter, validate(prepareRestoreSchema), backupController.prepareRestore);
platformAdminRouter.post('/backups/restores', authenticatePlatformAdmin, csrfProtection, backupLimiter, validate(startRestoreSchema), backupController.startRestore);
platformAdminRouter.get('/backups/restores/:id', authenticatePlatformAdmin, validate(backupIdSchema), backupController.getRestore);
platformAdminRouter.get('/backups', authenticatePlatformAdmin, validate(listBackupsSchema), backupController.list);
platformAdminRouter.post('/backups', authenticatePlatformAdmin, csrfProtection, backupLimiter, backupController.create);
platformAdminRouter.get('/backups/:id', authenticatePlatformAdmin, validate(backupIdSchema), backupController.get);
platformAdminRouter.post('/backups/:id/verify', authenticatePlatformAdmin, csrfProtection, backupLimiter, validate(backupIdSchema), backupController.verify);
platformAdminRouter.get('/backups/:id/download', authenticatePlatformAdmin, backupLimiter, validate(backupIdSchema), backupController.download);
platformAdminRouter.delete('/backups/:id', authenticatePlatformAdmin, csrfProtection, validate(backupIdSchema), backupController.remove);
