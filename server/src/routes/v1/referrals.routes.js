import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/authorize.js';
import { csrfProtection } from '../../middleware/csrf.js';
import { validate } from '../../middleware/validate.js';
import * as referralController from '../../controllers/referral.controller.js';
import { listReferralsSchema, approveReferralSchema, referralIdParamSchema } from '../../validators/referral.validators.js';

export const referralsRouter = Router();

referralsRouter.use(authenticate);
referralsRouter.get('/', requirePermission('referrals:read'), validate(listReferralsSchema), referralController.list);
referralsRouter.post('/:id/approve', csrfProtection, requirePermission('referrals:approve'), validate(approveReferralSchema), referralController.approve);
referralsRouter.post('/:id/mark-paid', csrfProtection, requirePermission('referrals:mark-paid'), validate(referralIdParamSchema), referralController.markPaid);
