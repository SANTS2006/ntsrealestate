import { z } from 'zod';

const emptyToUndefined = (v) => (v === '' || v === null || v === undefined ? undefined : v);
const optionalString = (schema) => z.preprocess(emptyToUndefined, schema.optional());
const optionalNumber = (schema) => z.preprocess(emptyToUndefined, schema.optional());
const money = z.coerce.number({ invalid_type_error: 'Enter an amount.' }).positive('Must be greater than 0.').max(9_999_999_999);
const nonNegativeMoney = optionalNumber(z.coerce.number().nonnegative().max(9_999_999_999));

export const invoiceCreateFormSchema = z
  .object({
    tenantId: z.string().uuid('Select a tenant.'),
    leaseId: optionalString(z.string().uuid()),
    issueDate: z.string().min(1, 'Issue date is required.'),
    dueDate: z.string().min(1, 'Due date is required.'),
    subtotal: money,
    tax: nonNegativeMoney,
  })
  .refine((data) => new Date(data.dueDate) >= new Date(data.issueDate), { message: 'Due date must be on or after the issue date.', path: ['dueDate'] });

export const invoiceEditFormSchema = z.object({
  dueDate: optionalString(z.string()),
  subtotal: optionalNumber(money),
  tax: nonNegativeMoney,
});

export const invoiceVoidFormSchema = z.object({
  reason: optionalString(z.string().trim().max(500)),
});

export const generateInvoiceFormSchema = z.object({
  issueDate: optionalString(z.string()),
  dueDate: optionalString(z.string()),
});
