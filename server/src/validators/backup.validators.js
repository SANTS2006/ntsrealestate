import { z } from 'zod';
import { paginationQuery, uuidParam } from './common.validators.js';

export const listBackupsSchema = z.object({
  query: z.object({
    ...paginationQuery,
    type: z.enum(['AUTOMATIC', 'MANUAL', 'PRE_RESTORE']).optional(),
    status: z.enum(['RUNNING', 'COMPLETED', 'FAILED', 'DELETED']).optional(),
  }),
});
export const listRestoresSchema = z.object({ query: z.object({ ...paginationQuery }) });
export const backupIdSchema = z.object({ params: z.object(uuidParam('id')) });
export const policySchema = z.object({
  body: z.object({
    retentionCount: z.number().int().min(1).max(365),
    retentionDays: z.number().int().min(1).max(3650),
  }).strict(),
});
export const prepareRestoreSchema = z.object({ body: z.object({ backupId: z.string().uuid() }).strict() });
export const startRestoreSchema = z.object({
  body: z.object({
    backupId: z.string().uuid(),
    token: z.string().min(10).max(200),
    confirmation: z.string().max(50),
    password: z.string().min(1).max(200),
  }).strict(),
});
