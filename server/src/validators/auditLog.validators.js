import { z } from 'zod';
import { paginationQuery } from './common.validators.js';

export const listAuditLogsSchema = z.object({
  query: z.object({
    ...paginationQuery,
    action: z.string().trim().max(100).optional(),
    entityType: z.string().trim().max(100).optional(),
    userId: z.string().uuid().optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  }),
});
