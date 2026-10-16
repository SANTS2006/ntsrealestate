import { z } from 'zod';
import { paginationQuery, uuidParam } from './common.validators.js';

export const dealIdParamSchema = z.object({ params: z.object(uuidParam('id')) });

export const listDealsSchema = z.object({
  query: z.object({
    ...paginationQuery,
    kind: z.enum(['rent', 'buy', 'lease']).optional(),
    status: z.enum(['pending', 'approved', 'completed', 'cancelled']).optional(),
  }),
});

export const requestDealSchema = z.object({
  body: z.object({
    kind: z.enum(['rent', 'buy', 'lease']),
    unitId: z.string().uuid().optional(),
    landId: z.string().uuid().optional(),
    notes: z.string().trim().max(1000).optional(),
  }).strict(),
});

export const updateDealStatusSchema = z.object({
  params: z.object(uuidParam('id')),
  body: z.object({ status: z.enum(['approved', 'completed', 'cancelled']) }).strict(),
});

const isoDate = z.coerce.date();

export const setPlanSchema = z.object({
  params: z.object(uuidParam('id')),
  body: z.object({
    startDate: isoDate.optional(),
    termMonths: z.number().int().min(1).max(600),
    frequency: z.enum(['monthly', 'yearly']),
    installmentAmount: z.number().positive().max(1_000_000_000),
    securityDeposit: z.number().min(0).max(1_000_000_000).optional(),
  }).strict(),
});

export const renewDealSchema = z.object({
  params: z.object(uuidParam('id')),
  body: z.object({
    termMonths: z.number().int().min(1).max(600).optional(),
    frequency: z.enum(['monthly', 'yearly']).optional(),
    installmentAmount: z.number().positive().max(1_000_000_000).optional(),
  }).strict(),
});

export const endDealSchema = z.object({
  params: z.object(uuidParam('id')),
  body: z.object({
    reason: z.enum(['cancelled', 'moved_out', 'expired']),
    note: z.string().trim().max(500).optional(),
  }).strict(),
});
