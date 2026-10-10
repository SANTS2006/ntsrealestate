import { z } from 'zod';
import { paginationQuery, uuidParam } from './common.validators.js';

// Mirrors the Prisma DocumentEntityType enum (server/prisma/schema.prisma).
// Only `organization` and `user` are actually resolvable before Phase 7 -
// see services/documentEntityResolver.js - but the full enum is validated
// here so the API shape doesn't need to change as later phases add
// resolvers for the rest.
const documentEntityType = z.enum([
  'property', 'building', 'unit', 'land', 'tenant', 'owner', 'lease', 'invoice', 'payment', 'expense',
  'maintenance_request', 'work_order', 'inspection', 'vendor', 'user', 'organization',
]);

export const uploadDocumentSchema = z.object({
  body: z.object({
    entityType: documentEntityType,
    entityId: z.string().uuid('Invalid entityId.'),
  }).strict(),
});

export const listDocumentsSchema = z.object({
  query: z.object({
    ...paginationQuery,
    entityType: documentEntityType,
    entityId: z.string().uuid('Invalid entityId.'),
  }),
});

export const documentIdParamSchema = z.object({
  params: z.object(uuidParam('id')),
});
