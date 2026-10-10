import { z } from 'zod';
import { paginationQuery } from './common.validators.js';

export const listTenantMessagesSchema = z.object({
  query: z.object({ ...paginationQuery }),
});

export const createTenantMessageSchema = z.object({
  body: z.object({
    content: z.string().trim().min(1, 'A message cannot be empty.').max(2000),
  }).strict(),
});
