import { z } from 'zod';
import { paginationQuery, uuidParam } from './common.validators.js';

const money = z.coerce.number().positive().max(9_999_999_999);

export const listPaymentsSchema = z.object({
  query: z.object({
    ...paginationQuery,
    status: z.enum(['pending', 'completed', 'failed', 'refunded', 'reversed']).optional(),
    tenantId: z.string().uuid().optional(),
    invoiceId: z.string().uuid().optional(),
  }),
});

export const paymentIdParamSchema = z.object({ params: z.object(uuidParam('id')) });

export const recordPaymentSchema = z.object({
  body: z.object({
    // Not needed when the payment is for a deal — the deal's customer is used.
    tenantId: z.string().uuid().optional(),
    dealId: z.string().uuid().optional(),
    invoiceId: z.string().uuid().optional(),
    leaseId: z.string().uuid().optional(),
    amount: money,
    currency: z.string().trim().length(3).toUpperCase().optional(),
    paymentDate: z.coerce.date().optional(),
    paymentMethod: z.enum(['cash', 'bank_transfer', 'card', 'mobile_money', 'cheque', 'other']),
    reference: z.string().trim().max(200).optional(),
    notes: z.string().trim().max(1000).optional(),
    // A client-generated idempotency key (e.g. a UUID minted once per
    // submit action, resent unchanged on retry) — see payment.service.js.
    idempotencyKey: z.string().trim().min(8).max(200).optional(),
  }).strict(),
});

export const refundPaymentSchema = z.object({
  params: z.object(uuidParam('id')),
  body: z.object({ reason: z.string().trim().max(500).optional() }).strict(),
});
