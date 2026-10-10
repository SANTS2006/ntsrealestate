import { z } from 'zod';

const emptyToUndefined = (v) => (v === '' || v === null || v === undefined ? undefined : v);
const optionalNumber = (schema) => z.preprocess(emptyToUndefined, schema.optional());
const optionalString = (schema) => z.preprocess(emptyToUndefined, schema.optional());
const money = optionalNumber(z.coerce.number().nonnegative().max(9_999_999_999));

export const unitFormSchema = z.object({
  unitNumber: z.string().trim().min(1, 'Unit number is required.').max(50),
  unitType: optionalString(z.string().trim().max(50)),
  floor: optionalNumber(z.coerce.number().int().min(-10).max(300)),
  bedrooms: optionalNumber(z.coerce.number().int().min(0).max(50)),
  bathrooms: optionalNumber(z.coerce.number().int().min(0).max(50)),
  area: money,
  monthlyRent: optionalNumber(z.coerce.number().min(0).max(9_999_999_999)),
  offerRent: z.boolean().optional(),
  offerSale: z.boolean().optional(),
  offerLease: z.boolean().optional(),
  salePrice: optionalNumber(z.coerce.number().positive().max(9_999_999_999)),
  leasePrice: optionalNumber(z.coerce.number().positive().max(9_999_999_999)),
  leaseTermMonths: optionalNumber(z.coerce.number().int().min(1).max(1200)),
  securityDeposit: money,
  description: optionalString(z.string().trim().max(2000)),
  furnished: z.boolean().optional(),
  isShared: z.boolean().optional(),
}).superRefine((v, ctx) => {
  const rent = v.offerRent !== false;
  if (!rent && !v.offerSale && !v.offerLease) ctx.addIssue({ code: 'custom', path: ['offerRent'], message: 'Choose at least one way to offer this: rent, sale or lease.' });
  if (rent && !(Number(v.monthlyRent) > 0)) ctx.addIssue({ code: 'custom', path: ['monthlyRent'], message: 'Enter the rent per month.' });
  if (v.offerSale && !(Number(v.salePrice) > 0)) ctx.addIssue({ code: 'custom', path: ['salePrice'], message: 'Enter the sale price.' });
  if (v.offerLease && !(Number(v.leasePrice) > 0)) ctx.addIssue({ code: 'custom', path: ['leasePrice'], message: 'Enter the lease price.' });
});
