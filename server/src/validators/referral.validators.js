import { z } from 'zod';
import { paginationQuery, uuidParam } from './common.validators.js';

export const listReferralsSchema = z.object({
  query: z.object({
    ...paginationQuery,
    status: z.enum(['pending', 'approved', 'paid']).optional(),
  }),
});

export const referralIdParamSchema = z.object({ params: z.object(uuidParam('id')) });

export const approveReferralSchema = z.object({
  params: z.object(uuidParam('id')),
  body: z.object({
    bonusAmount: z.coerce.number().positive().max(1_000_000),
  }).strict(),
});
