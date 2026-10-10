import { z } from 'zod';
import { paginationQuery, uuidParam } from './common.validators.js';

const money = z.coerce.number().nonnegative().max(9_999_999_999);

export const listWorkOrdersSchema = z.object({
  query: z.object({
    ...paginationQuery,
    status: z.enum(['pending', 'scheduled', 'in_progress', 'completed', 'cancelled']).optional(),
    vendorId: z.string().uuid().optional(),
  }),
});

export const maintenanceRequestIdParamSchema = z.object({ params: z.object(uuidParam('maintenanceRequestId')) });
export const workOrderIdParamSchema = z.object({ params: z.object(uuidParam('id')) });

export const createWorkOrderSchema = z.object({
  params: z.object(uuidParam('maintenanceRequestId')),
  body: z.object({
    vendorId: z.string().uuid().optional(),
    assignedStaffId: z.string().uuid().optional(),
    scheduledDate: z.coerce.date().optional(),
    estimatedCost: money.optional(),
  }).strict(),
});

export const updateWorkOrderSchema = z.object({
  params: z.object(uuidParam('id')),
  body: z.object({
    vendorId: z.string().uuid().optional(),
    assignedStaffId: z.string().uuid().optional(),
    scheduledDate: z.coerce.date().optional(),
    estimatedCost: money.optional(),
  }).strict(),
});

export const completeWorkOrderSchema = z.object({
  params: z.object(uuidParam('id')),
  body: z.object({ actualCost: money.optional() }).strict(),
});
