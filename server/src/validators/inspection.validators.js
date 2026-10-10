import { z } from 'zod';
import { paginationQuery, uuidParam } from './common.validators.js';

export const listInspectionsSchema = z.object({
  query: z.object({
    ...paginationQuery,
    status: z.enum(['scheduled', 'in_progress', 'completed', 'cancelled']).optional(),
    type: z.enum(['move_in', 'move_out', 'routine', 'property', 'unit']).optional(),
    propertyId: z.string().uuid().optional(),
  }),
});

export const inspectionIdParamSchema = z.object({ params: z.object(uuidParam('id')) });

export const scheduleInspectionSchema = z.object({
  body: z.object({
    propertyId: z.string().uuid(),
    buildingId: z.string().uuid().optional(),
    unitId: z.string().uuid().optional(),
    inspectorId: z.string().uuid().optional(),
    inspectionDate: z.coerce.date(),
    type: z.enum(['move_in', 'move_out', 'routine', 'property', 'unit']),
  }).strict(),
});

export const updateInspectionSchema = z.object({
  params: z.object(uuidParam('id')),
  body: z.object({
    inspectionDate: z.coerce.date().optional(),
    inspectorId: z.string().uuid().optional(),
    condition: z.string().trim().max(500).optional(),
    notes: z.string().trim().max(2000).optional(),
  }).strict(),
});

export const completeInspectionSchema = z.object({
  params: z.object(uuidParam('id')),
  body: z.object({
    condition: z.string().trim().max(500).optional(),
    notes: z.string().trim().max(2000).optional(),
  }).strict(),
});
