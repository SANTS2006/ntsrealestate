import { z } from 'zod';

const emptyToUndefined = (v) => (v === '' || v === null || v === undefined ? undefined : v);
const optionalString = (schema) => z.preprocess(emptyToUndefined, schema.optional());
const money = z.coerce.number({ invalid_type_error: 'Enter an amount.' }).positive('Must be greater than 0.').max(9_999_999_999);

export const PAYMENT_METHODS = ['cash', 'bank_transfer', 'card', 'mobile_money', 'cheque', 'other'];

export const paymentFormSchema = z.object({
  tenantId: z.string().uuid('Select a tenant.'),
  invoiceId: optionalString(z.string().uuid()),
  leaseId: optionalString(z.string().uuid()),
  amount: money,
  paymentDate: optionalString(z.string()),
  paymentMethod: z.enum(PAYMENT_METHODS, { errorMap: () => ({ message: 'Select a payment method.' }) }),
  reference: optionalString(z.string().trim().max(200)),
  notes: optionalString(z.string().trim().max(1000)),
});

export const paymentRefundFormSchema = z.object({
  reason: optionalString(z.string().trim().max(500)),
});
