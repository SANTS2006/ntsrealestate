import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/authorize.js';
import { csrfProtection } from '../../middleware/csrf.js';
import { validate } from '../../middleware/validate.js';
import * as paymentController from '../../controllers/payment.controller.js';
import { listPaymentsSchema, paymentIdParamSchema, recordPaymentSchema, refundPaymentSchema } from '../../validators/payment.validators.js';

export const paymentsRouter = Router();

paymentsRouter.use(authenticate);

paymentsRouter.get('/', requirePermission('payments:read'), validate(listPaymentsSchema), paymentController.list);
paymentsRouter.get('/:id', requirePermission('payments:read'), validate(paymentIdParamSchema), paymentController.get);
paymentsRouter.get('/:id/receipt', requirePermission('payments:read'), validate(paymentIdParamSchema), paymentController.receipt);
paymentsRouter.post('/', csrfProtection, requirePermission('payments:create'), validate(recordPaymentSchema), paymentController.create);
paymentsRouter.delete('/:id', csrfProtection, requirePermission('payments:delete'), validate(paymentIdParamSchema), paymentController.remove);
paymentsRouter.post('/:id/refund', csrfProtection, requirePermission('payments:refund'), validate(refundPaymentSchema), paymentController.refund);
