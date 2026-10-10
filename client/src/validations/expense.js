import { z } from 'zod';

const emptyToUndefined = (v) => (v === '' || v === null || v === undefined ? undefined : v);
const optionalString = (schema) => z.preprocess(emptyToUndefined, schema.optional());
const money = z.coerce.number({ invalid_type_error: 'Enter an amount.' }).positive('Must be greater than 0.').max(9_999_999_999);

export const expenseFormSchema = z.object({
  categoryId: z.string().uuid('Select a category.'),
  propertyId: optionalString(z.string().uuid()),
  amount: money,
  expenseDate: z.string().min(1, 'Expense date is required.'),
  description: optionalString(z.string().trim().max(1000)),
});

export const expenseCategoryFormSchema = z.object({
  name: z.string().trim().min(1, 'Category name is required.').max(100),
  description: optionalString(z.string().trim().max(500)),
});
