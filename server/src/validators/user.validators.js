import { z } from 'zod';
import { paginationQuery, uuidParam } from './common.validators.js';

const roleNameSlug = z.string().trim().min(1).max(50).regex(/^[a-z0-9_]+$/, 'Role name must be lowercase snake_case.');

export const listUsersSchema = z.object({
  query: z.object({
    ...paginationQuery,
    status: z.enum(['pending', 'active', 'inactive', 'locked']).optional(),
  }),
});

export const getUserSchema = z.object({
  params: z.object(uuidParam('id')),
});

export const inviteUserSchema = z.object({
  body: z.object({
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    email: z.string().trim().toLowerCase().email().max(254),
    role: roleNameSlug,
  }).strict(),
});

export const updateUserStatusSchema = z.object({
  params: z.object(uuidParam('id')),
  body: z.object({ status: z.enum(['active', 'inactive']) }).strict(),
});

export const updateUserRoleSchema = z.object({
  params: z.object(uuidParam('id')),
  body: z.object({ role: roleNameSlug }).strict(),
});

export const removeUserRoleSchema = z.object({
  params: z.object({ ...uuidParam('id'), role: roleNameSlug }),
});
