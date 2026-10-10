import { z } from 'zod';

// Mirrors server/src/validators/property.validators.js for immediate
// feedback — the server re-validates everything (see auth.js's identical
// note). Empty-string optional fields are normalized to undefined so
// react-hook-form's default '' doesn't fail z.coerce.number().
const emptyToUndefined = (v) => (v === '' || v === null || v === undefined ? undefined : v);
const optionalNumber = (schema) => z.preprocess(emptyToUndefined, schema.optional());
const optionalString = (schema) => z.preprocess(emptyToUndefined, schema.optional());

export const propertyFormSchema = z.object({
  propertyCode: z.string().trim().min(1, 'Property code is required.').max(50),
  name: z.string().trim().min(1, 'Property name is required.').max(200),
  propertyType: z.string().trim().min(1, 'Property type is required.').max(50),
  description: optionalString(z.string().trim().max(2000)),
  address: z.string().trim().min(1, 'Address is required.').max(300),
  city: optionalString(z.string().trim().max(100)),
  region: optionalString(z.string().trim().max(100)),
  country: optionalString(z.string().trim().max(100)),
  latitude: optionalNumber(z.coerce.number().min(-90).max(90)),
  longitude: optionalNumber(z.coerce.number().min(-180).max(180)),
  yearBuilt: optionalNumber(z.coerce.number().int().min(1800).max(2100)),
  // Chosen by administrators and agents; owners never pick (their own).
  ownerId: optionalString(z.string().uuid('Choose an owner from the list.')),
  isShared: z.boolean().optional(),
});

const money = optionalNumber(z.coerce.number().nonnegative().max(9_999_999_999));

// Price and details of something rented as a whole.
export const rentalFormSchema = z.object({
  monthlyRent: optionalNumber(z.coerce.number().min(0).max(9_999_999_999)),
  offerRent: z.boolean().optional(),
  offerSale: z.boolean().optional(),
  offerLease: z.boolean().optional(),
  salePrice: optionalNumber(z.coerce.number().positive().max(9_999_999_999)),
  leasePrice: optionalNumber(z.coerce.number().positive().max(9_999_999_999)),
  leaseTermMonths: optionalNumber(z.coerce.number().int().min(1).max(1200)),
  securityDeposit: money,
  unitType: optionalString(z.string().trim().max(50)),
  bedrooms: optionalNumber(z.coerce.number().int().min(0).max(50)),
  bathrooms: optionalNumber(z.coerce.number().int().min(0).max(50)),
  area: money,
  floor: optionalNumber(z.coerce.number().int().min(-10).max(300)),
  furnished: z.boolean().optional(),
  description: optionalString(z.string().trim().max(2000)),
}).superRefine((v, ctx) => {
  const rent = v.offerRent !== false;
  if (!rent && !v.offerSale && !v.offerLease) ctx.addIssue({ code: 'custom', path: ['offerRent'], message: 'Choose at least one way to offer this: rent, sale or lease.' });
  if (rent && !(Number(v.monthlyRent) > 0)) ctx.addIssue({ code: 'custom', path: ['monthlyRent'], message: 'Enter the rent per month.' });
  if (v.offerSale && !(Number(v.salePrice) > 0)) ctx.addIssue({ code: 'custom', path: ['salePrice'], message: 'Enter the sale price.' });
  if (v.offerLease && !(Number(v.leasePrice) > 0)) ctx.addIssue({ code: 'custom', path: ['leasePrice'], message: 'Enter the lease price.' });
});

// A "whole property" also needs its price and details.
export const wholePropertyFormSchema = propertyFormSchema.extend({ rental: rentalFormSchema });
