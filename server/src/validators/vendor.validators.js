import { z } from 'zod';
import { paginationQuery, uuidParam } from './common.validators.js';

const vendorBody = {
  name: z.string().trim().min(1).max(200),
  contactPerson: z.string().trim().max(200).nullable().optional(),
  email: z.string().trim().toLowerCase().email().max(254).nullable().optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  address: z.string().trim().max(300).nullable().optional(),
  serviceType: z.string().trim().max(100).nullable().optional(),
};

export const listVendorsSchema = z.object({
  query: z.object({ ...paginationQuery, status: z.enum(['active', 'inactive']).optional(), serviceType: z.string().trim().max(100).optional() }),
});

export const vendorIdParamSchema = z.object({ params: z.object(uuidParam('id')) });

export const createVendorSchema = z.object({ body: z.object(vendorBody).strict() });

export const updateVendorSchema = z.object({
  params: z.object(uuidParam('id')),
  body: z.object({ ...vendorBody, name: vendorBody.name.optional() }).strict(),
});

export const setVendorStatusSchema = z.object({
  params: z.object(uuidParam('id')),
  body: z.object({ status: z.enum(['active', 'inactive']) }),
});
