import { z } from 'zod';
import { paginationQuery, uuidParam } from './common.validators.js';

export const LAND_TYPES = ['residential', 'commercial', 'agricultural', 'industrial', 'mixed_use', 'other'];
export const AREA_UNITS = ['acres', 'hectares', 'sqm', 'plots'];

const optionalText = (max) => z.string().trim().max(max).nullable().optional();
const features = z.array(z.string().trim().min(1).max(60)).max(40).optional();

const fields = {
  title: z.string().trim().min(1).max(200),
  description: optionalText(4000),
  landType: z.enum(LAND_TYPES),
  area: z.coerce.number().positive().max(999_999_999),
  areaUnit: z.enum(AREA_UNITS),
  price: z.coerce.number().positive().max(9_999_999_999),
  address: optionalText(300),
  city: optionalText(100),
  region: optionalText(100),
  country: optionalText(100),
  latitude: z.coerce.number().min(-90).max(90).nullable().optional(),
  longitude: z.coerce.number().min(-180).max(180).nullable().optional(),
  titleDocument: optionalText(200),
  features,
  ownerId: z.string().uuid().nullable().optional(),
};

export const landIdParamSchema = z.object({ params: z.object(uuidParam('id')) });

export const listLandsSchema = z.object({
  query: z.object({ ...paginationQuery, status: z.enum(['available', 'reserved', 'sold', 'unavailable']).optional() }),
});

export const createLandSchema = z.object({ body: z.object(fields).strict() });

export const updateLandSchema = z.object({
  params: z.object(uuidParam('id')),
  body: z.object({
    ...Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.optional()])),
    status: z.enum(['available', 'reserved', 'sold', 'unavailable']).optional(),
  }).strict(),
});
