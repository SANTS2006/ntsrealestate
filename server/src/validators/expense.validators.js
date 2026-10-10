import { z } from 'zod';
import { paginationQuery, uuidParam } from './common.validators.js';

const money = z.coerce.number().positive().max(9_999_999_999);

export const listExpensesSchema = z.object({
  query: z.object({
    ...paginationQuery,
    status: z.enum(['pending_approval', 'approved', 'rejected', 'paid']).optional(),
    propertyId: z.string().uuid().optional(),
    categoryId: z.string().uuid().optional(),
  }),
});

export const expenseIdParamSchema = z.object({ params: z.object(uuidParam('id')) });

export const createExpenseSchema = z.object({
  body: z.object({
    propertyId: z.string().uuid().optional(),
    categoryId: z.string().uuid(),
    vendorId: z.string().uuid().optional(),
    amount: money,
    currency: z.string().trim().length(3).toUpperCase().optional(),
    expenseDate: z.coerce.date(),
    description: z.string().trim().max(1000).optional(),
    receiptDocumentId: z.string().uuid().optional(),
  }).strict(),
});

export const createExpenseCategorySchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(100),
    description: z.string().trim().max(500).optional(),
  }).strict(),
});
