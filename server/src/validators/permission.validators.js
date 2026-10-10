import { z } from 'zod';
import { uuidParam } from './common.validators.js';

// Enforces the "resource:action" convention every seeded permission already
// follows (see constants/permissions.js) so a custom permission an admin
// adds slots into the same shape the authorization checks expect.
export const createPermissionSchema = z.object({
  body: z.object({
    name: z.string().trim().toLowerCase().min(3).max(100).regex(/^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$/, 'Use the format "resource:action" (lowercase letters, numbers, and hyphens).'),
    description: z.string().trim().max(255).nullable().optional(),
  }).strict(),
});

export const permissionIdParamSchema = z.object({ params: z.object(uuidParam('id')) });

// The name is immutable once created — it's the identifier `requirePermission()`
// checks match against, so only the description can be edited.
export const updatePermissionSchema = z.object({
  params: z.object(uuidParam('id')),
  body: z.object({
    description: z.string().trim().max(255).nullable().optional(),
  }).strict(),
});
