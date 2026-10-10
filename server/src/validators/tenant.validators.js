import { z } from 'zod';
import { paginationQuery, uuidParam } from './common.validators.js';

const emergencyContact = z.object({
  name: z.string().trim().min(1).max(200),
  phone: z.string().trim().min(1).max(30),
  relationship: z.string().trim().max(100).optional(),
}).nullable().optional();

export const listTenantsSchema = z.object({
  query: z.object({
    ...paginationQuery,
    status: z.enum(['active', 'inactive', 'former']).optional(),
    unitId: z.string().uuid().optional(),
    buildingId: z.string().uuid().optional(),
  }),
});

export const tenantIdParamSchema = z.object({ params: z.object(uuidParam('id')) });

export const createTenantSchema = z.object({
  body: z.object({
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    email: z.string().trim().toLowerCase().email().max(254).nullable().optional(),
    phone: z.string().trim().max(30).nullable().optional(),
    emergencyContact,
    userId: z.string().uuid().nullable().optional(),
    buildingId: z.string().uuid().nullable().optional(),
    unitId: z.string().uuid().nullable().optional(),
  }).strict(),
});

export const updateTenantSchema = z.object({
  params: z.object(uuidParam('id')),
  body: z.object({
    firstName: z.string().trim().min(1).max(100).optional(),
    lastName: z.string().trim().min(1).max(100).optional(),
    email: z.string().trim().toLowerCase().email().max(254).nullable().optional(),
    phone: z.string().trim().max(30).nullable().optional(),
    emergencyContact,
    buildingId: z.string().uuid().nullable().optional(),
    unitId: z.string().uuid().nullable().optional(),
  }).strict(),
});

export const setTenantStatusSchema = z.object({
  params: z.object(uuidParam('id')),
  body: z.object({ status: z.enum(['active', 'inactive', 'former']) }),
});
