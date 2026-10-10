import { z } from 'zod';
import { paginationQuery } from './common.validators.js';

export const listAuditRemarksSchema = z.object({
  query: z.object({ ...paginationQuery }),
});

export const createAuditRemarkSchema = z.object({
  body: z.object({
    content: z.string().trim().min(1, 'A remark cannot be empty.').max(5000),
  }).strict(),
});
