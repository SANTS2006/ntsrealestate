import { z } from 'zod';
import { paginationQuery, uuidParam } from './common.validators.js';

export const listMaintenanceRequestsSchema = z.object({
  query: z.object({
    ...paginationQuery,
    status: z.enum(['open', 'in_review', 'assigned', 'scheduled', 'in_progress', 'completed', 'cancelled']).optional(),
    priority: z.enum(['low', 'medium', 'high', 'emergency']).optional(),
    propertyId: z.string().uuid().optional(),
    tenantId: z.string().uuid().optional(),
  }),
});

export const maintenanceRequestIdParamSchema = z.object({ params: z.object(uuidParam('id')) });

export const createMaintenanceRequestSchema = z.object({
  body: z.object({
    propertyId: z.string().uuid().optional(),
    unitId: z.string().uuid().optional(),
    tenantId: z.string().uuid().optional(),
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(2000).optional(),
    priority: z.enum(['low', 'medium', 'high', 'emergency']).optional(),
  }).strict(),
});

export const assignMaintenanceRequestSchema = z.object({
  params: z.object(uuidParam('id')),
  body: z.object({ vendorId: z.string().uuid() }).strict(),
});
