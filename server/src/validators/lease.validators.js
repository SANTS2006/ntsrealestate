import { z } from 'zod';
import { paginationQuery, uuidParam } from './common.validators.js';

const isoDate = z.coerce.date();
const money = z.coerce.number().positive().max(9_999_999_999);

export const listLeasesSchema = z.object({
  query: z.object({
    ...paginationQuery,
    status: z.enum(['draft', 'active', 'expiring_soon', 'expired', 'terminated', 'renewed']).optional(),
    tenantId: z.string().uuid().optional(),
    unitId: z.string().uuid().optional(),
  }),
});

export const leaseIdParamSchema = z.object({ params: z.object(uuidParam('id')) });

export const createLeaseSchema = z.object({
  body: z.object({
    unitId: z.string().uuid(),
    tenantId: z.string().uuid(),
    startDate: isoDate,
    endDate: isoDate,
    monthlyRent: money,
    securityDeposit: money.optional(),
    paymentDueDay: z.coerce.number().int().min(1).max(28).optional(),
    terms: z.record(z.unknown()).nullable().optional(),
  }).strict().refine((data) => data.endDate > data.startDate, { message: 'endDate must be after startDate', path: ['endDate'] }),
});

export const updateLeaseSchema = z.object({
  params: z.object(uuidParam('id')),
  body: z.object({
    monthlyRent: money.optional(),
    securityDeposit: money.optional(),
    paymentDueDay: z.coerce.number().int().min(1).max(28).optional(),
    endDate: isoDate.optional(),
    terms: z.record(z.unknown()).nullable().optional(),
  }).strict(),
});

export const terminateLeaseSchema = z.object({
  params: z.object(uuidParam('id')),
  body: z.object({ reason: z.string().trim().max(500).optional() }).strict(),
});

export const renewLeaseSchema = z.object({
  params: z.object(uuidParam('id')),
  body: z.object({
    startDate: isoDate.optional(),
    endDate: isoDate,
    monthlyRent: money.optional(),
    securityDeposit: money.optional(),
    paymentDueDay: z.coerce.number().int().min(1).max(28).optional(),
  }).strict(),
});
