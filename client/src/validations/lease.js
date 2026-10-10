import { z } from 'zod';

const emptyToUndefined = (v) => (v === '' || v === null || v === undefined ? undefined : v);
const optionalNumber = (schema) => z.preprocess(emptyToUndefined, schema.optional());
const optionalString = (schema) => z.preprocess(emptyToUndefined, schema.optional());
const money = z.coerce.number({ invalid_type_error: 'Enter an amount.' }).positive('Must be greater than 0.').max(9_999_999_999);
const dueDay = optionalNumber(z.coerce.number().int().min(1).max(28));

export const leaseCreateFormSchema = z
  .object({
    unitId: z.string().uuid('Select a unit.'),
    tenantId: z.string().uuid('Select a tenant.'),
    startDate: z.string().min(1, 'Start date is required.'),
    endDate: z.string().min(1, 'End date is required.'),
    monthlyRent: money,
    securityDeposit: optionalNumber(z.coerce.number().nonnegative().max(9_999_999_999)),
    paymentDueDay: dueDay,
  })
  .refine((data) => new Date(data.endDate) > new Date(data.startDate), { message: 'End date must be after the start date.', path: ['endDate'] });

export const leaseEditFormSchema = z.object({
  monthlyRent: optionalNumber(money),
  securityDeposit: optionalNumber(z.coerce.number().nonnegative().max(9_999_999_999)),
  paymentDueDay: dueDay,
  endDate: optionalString(z.string()),
});

export const leaseRenewFormSchema = z.object({
  startDate: optionalString(z.string()),
  endDate: z.string().min(1, 'End date is required.'),
  monthlyRent: optionalNumber(money),
  securityDeposit: optionalNumber(z.coerce.number().nonnegative().max(9_999_999_999)),
  paymentDueDay: dueDay,
});

export const leaseTerminateFormSchema = z.object({
  reason: optionalString(z.string().trim().max(500)),
});
