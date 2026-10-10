import { z } from 'zod';
import { paginationQuery, uuidParam } from './common.validators.js';

const amenityList = z.array(z.string().trim().min(1).max(60)).max(40).optional();
const money = z.coerce.number().nonnegative().max(9_999_999_999).nullable().optional();

// The rentable details of a whole property (and, for "buildings" properties,
// of each building) — stored on the automatic unit that stands for it.
export const rentalDetailsSchema = z.object({
  monthlyRent: z.coerce.number().min(0).max(9_999_999_999).optional(),
  isShared: z.boolean().optional(),
  offerRent: z.boolean().optional(),
  offerSale: z.boolean().optional(),
  offerLease: z.boolean().optional(),
  salePrice: z.coerce.number().positive().max(9_999_999_999).nullable().optional(),
  leasePrice: z.coerce.number().positive().max(9_999_999_999).nullable().optional(),
  leaseTermMonths: z.coerce.number().int().min(1).max(1200).nullable().optional(),
  securityDeposit: money,
  bedrooms: z.coerce.number().int().min(0).max(50).nullable().optional(),
  bathrooms: z.coerce.number().int().min(0).max(50).nullable().optional(),
  area: money,
  floor: z.coerce.number().int().min(-10).max(300).nullable().optional(),
  unitType: z.string().trim().max(50).nullable().optional(),
  furnished: z.boolean().optional(),
  amenities: amenityList,
  description: z.string().trim().max(2000).nullable().optional(),
}).strict();

const latitude = z.coerce.number().min(-90).max(90).nullable().optional();
const longitude = z.coerce.number().min(-180).max(180).nullable().optional();

export const listPropertiesSchema = z.object({
  query: z.object({
    ...paginationQuery,
    status: z.enum(['active', 'archived', 'under_construction']).optional(),
  }),
});

export const propertyIdParamSchema = z.object({ params: z.object(uuidParam('id')) });

export const createPropertySchema = z.object({
  body: z.object({
    structureType: z.enum(['whole', 'buildings', 'buildings_units', 'units']).optional(),
    isShared: z.boolean().optional(),
    amenities: amenityList,
    rental: rentalDetailsSchema.optional(),
    propertyCode: z.string().trim().min(1).max(50),
    name: z.string().trim().min(1).max(200),
    propertyType: z.string().trim().min(1).max(50),
    description: z.string().trim().max(2000).nullable().optional(),
    address: z.string().trim().min(1).max(300),
    city: z.string().trim().max(100).nullable().optional(),
    region: z.string().trim().max(100).nullable().optional(),
    country: z.string().trim().max(100).nullable().optional(),
    latitude,
    longitude,
    yearBuilt: z.coerce.number().int().min(1800).max(2100).nullable().optional(),
    ownerId: z.string().uuid().nullable().optional(),
  }).strict().superRefine((body, ctx) => {
    if (body.structureType === 'whole' && !body.rental) {
      ctx.addIssue({ code: 'custom', path: ['rental', 'monthlyRent'], message: 'Enter the price for this property.' });
    }
  }),
});

export const updatePropertySchema = z.object({
  params: z.object(uuidParam('id')),
  body: z.object({
    name: z.string().trim().min(1).max(200).optional(),
    propertyType: z.string().trim().min(1).max(50).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    address: z.string().trim().min(1).max(300).optional(),
    city: z.string().trim().max(100).nullable().optional(),
    region: z.string().trim().max(100).nullable().optional(),
    country: z.string().trim().max(100).nullable().optional(),
    latitude,
    longitude,
    yearBuilt: z.coerce.number().int().min(1800).max(2100).nullable().optional(),
    ownerId: z.string().uuid().nullable().optional(),
    amenities: amenityList,
    isShared: z.boolean().optional(),
  }).strict(),
});

export const assignStaffSchema = z.object({
  params: z.object(uuidParam('id')),
  body: z.object({ userId: z.string().uuid() }),
});

export const unassignStaffSchema = z.object({
  params: z.object({ ...uuidParam('id'), userId: z.string().uuid() }),
});
