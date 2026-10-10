import { z } from 'zod';
import { uuidParam } from './common.validators.js';
import { rentalDetailsSchema } from './property.validators.js';

export const propertyIdParamSchema = z.object({ params: z.object(uuidParam('propertyId')) });
export const buildingIdParamSchema = z.object({ params: z.object(uuidParam('id')) });

export const createBuildingSchema = z.object({
  params: z.object(uuidParam('propertyId')),
  body: z.object({
    name: z.string().trim().min(1).max(200),
    code: z.string().trim().max(50).nullable().optional(),
    floors: z.coerce.number().int().min(0).max(300).nullable().optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    isShared: z.boolean().optional(),
    rental: rentalDetailsSchema.optional(),
  }).strict(),
});

export const updateBuildingSchema = z.object({
  params: z.object(uuidParam('id')),
  body: z.object({
    name: z.string().trim().min(1).max(200).optional(),
    code: z.string().trim().max(50).nullable().optional(),
    floors: z.coerce.number().int().min(0).max(300).nullable().optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    isShared: z.boolean().optional(),
    rental: rentalDetailsSchema.partial().optional(),
  }).strict(),
});
