import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/authorize.js';
import { csrfProtection } from '../../middleware/csrf.js';
import { validate } from '../../middleware/validate.js';
import * as invoiceController from '../../controllers/invoice.controller.js';
import {
  listInvoicesSchema, invoiceIdParamSchema, createInvoiceSchema, updateInvoiceSchema,
  generateInvoiceFromLeaseSchema, voidInvoiceSchema,
} from '../../validators/invoice.validators.js';

export const invoicesRouter = Router();

invoicesRouter.use(authenticate);

invoicesRouter.get('/', requirePermission('invoices:read'), validate(listInvoicesSchema), invoiceController.list);
invoicesRouter.get('/:id', requirePermission('invoices:read'), validate(invoiceIdParamSchema), invoiceController.get);
invoicesRouter.post('/', csrfProtection, requirePermission('invoices:create'), validate(createInvoiceSchema), invoiceController.create);
invoicesRouter.patch('/:id', csrfProtection, requirePermission('invoices:update'), validate(updateInvoiceSchema), invoiceController.update);
invoicesRouter.delete('/:id', csrfProtection, requirePermission('invoices:delete'), validate(invoiceIdParamSchema), invoiceController.remove);
invoicesRouter.post('/:id/send', csrfProtection, requirePermission('invoices:update'), validate(invoiceIdParamSchema), invoiceController.send);
invoicesRouter.post('/:id/void', csrfProtection, requirePermission('invoices:void'), validate(voidInvoiceSchema), invoiceController.voidInvoice);

// Mounted separately at /leases/:leaseId/generate-invoice — see routes/v1/index.js.
export const generateInvoiceRouter = Router();
generateInvoiceRouter.use(authenticate);
generateInvoiceRouter.post(
  '/leases/:leaseId/generate-invoice',
  csrfProtection,
  requirePermission('invoices:create'),
  validate(generateInvoiceFromLeaseSchema),
  invoiceController.generateFromLease
);
