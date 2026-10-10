import { z } from 'zod';
import { paginationQuery, uuidParam } from './common.validators.js';

const isoDate = z.coerce.date();
const money = z.coerce.number().positive().max(9_999_999_999);
const nonNegativeMoney = z.coerce.number().nonnegative().max(9_999_999_999);

export const listInvoicesSchema = z.object({
  query: z.object({
    ...paginationQuery,
    status: z.enum(['draft', 'sent', 'partially_paid', 'paid', 'overdue', 'void']).optional(),
    tenantId: z.string().uuid().optional(),
    leaseId: z.string().uuid().optional(),
  }),
});

export const invoiceIdParamSchema = z.object({ params: z.object(uuidParam('id')) });

export const createInvoiceSchema = z.object({
  body: z.object({
    tenantId: z.string().uuid(),
    leaseId: z.string().uuid().optional(),
    issueDate: isoDate,
    dueDate: isoDate,
    subtotal: money,
    tax: nonNegativeMoney.optional(),
  }).strict().refine((data) => data.dueDate >= data.issueDate, { message: 'dueDate must be on or after issueDate', path: ['dueDate'] }),
});

export const updateInvoiceSchema = z.object({
  params: z.object(uuidParam('id')),
  body: z.object({
    dueDate: isoDate.optional(),
    subtotal: money.optional(),
    tax: nonNegativeMoney.optional(),
  }).strict(),
});

export const generateInvoiceFromLeaseSchema = z.object({
  params: z.object(uuidParam('leaseId')),
  body: z.object({
    issueDate: isoDate.optional(),
    dueDate: isoDate.optional(),
  }).strict(),
});

export const voidInvoiceSchema = z.object({
  params: z.object(uuidParam('id')),
  body: z.object({ reason: z.string().trim().max(500).optional() }).strict(),
});
