import { z } from 'zod';
import { paginationQuery, uuidParam } from './common.validators.js';

const ownerBody = {
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().toLowerCase().email().max(254).nullable().optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  address: z.string().trim().max(300).nullable().optional(),
  userId: z.string().uuid().nullable().optional(),
};

export const listOwnersSchema = z.object({
  query: z.object({ ...paginationQuery, status: z.enum(['active', 'inactive']).optional() }),
});

export const ownerIdParamSchema = z.object({ params: z.object(uuidParam('id')) });

// An owner needs an email: they are sent an invitation to set their password
// and activate their account.
export const createOwnerSchema = z.object({
  body: z.object({
    ...ownerBody,
    email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(254),
  }).strict(),
});

export const updateOwnerSchema = z.object({
  params: z.object(uuidParam('id')),
  body: z.object({ name: ownerBody.name.optional(), email: ownerBody.email, phone: ownerBody.phone, address: ownerBody.address }).strict(),
});

export const setOwnerStatusSchema = z.object({
  params: z.object(uuidParam('id')),
  body: z.object({ status: z.enum(['active', 'inactive']) }),
});
