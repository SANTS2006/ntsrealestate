import { z } from 'zod';
import { uuidParam } from './common.validators.js';

export const roleIdParamSchema = z.object({ params: z.object(uuidParam('id')) });

// Role names are used as internal identifiers (role.replace('_', ' ') is
// how the UI titleizes them), so the same lowercase_underscore convention
// as the seeded defaults (administrator, property_manager, ...) is enforced
// here rather than allowing arbitrary display strings.
export const createRoleSchema = z.object({
  body: z.object({
    name: z.string().trim().toLowerCase().min(2).max(50).regex(/^[a-z][a-z0-9_]*$/, 'Use lowercase letters, numbers, and underscores, starting with a letter.'),
    description: z.string().trim().max(255).nullable().optional(),
  }).strict(),
});

export const updateRoleSchema = z.object({
  params: z.object(uuidParam('id')),
  body: z.object({
    description: z.string().trim().max(255).nullable().optional(),
  }).strict(),
});

export const setRolePermissionsSchema = z.object({
  params: z.object(uuidParam('id')),
  body: z.object({
    permissionNames: z.array(z.string().min(1)).max(300),
  }).strict(),
});
