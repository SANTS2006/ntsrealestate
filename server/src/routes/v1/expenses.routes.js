import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/authorize.js';
import { csrfProtection } from '../../middleware/csrf.js';
import { validate } from '../../middleware/validate.js';
import * as expenseController from '../../controllers/expense.controller.js';
import {
  listExpensesSchema, expenseIdParamSchema, createExpenseSchema, createExpenseCategorySchema,
} from '../../validators/expense.validators.js';

export const expensesRouter = Router();

expensesRouter.use(authenticate);

expensesRouter.get('/categories', requirePermission('expenses:read'), expenseController.listCategories);
expensesRouter.post('/categories', csrfProtection, requirePermission('expenses:create'), validate(createExpenseCategorySchema), expenseController.createCategory);

expensesRouter.get('/', requirePermission('expenses:read'), validate(listExpensesSchema), expenseController.list);
expensesRouter.get('/:id', requirePermission('expenses:read'), validate(expenseIdParamSchema), expenseController.get);
expensesRouter.post('/', csrfProtection, requirePermission('expenses:create'), validate(createExpenseSchema), expenseController.create);
expensesRouter.delete('/:id', csrfProtection, requirePermission('expenses:delete'), validate(expenseIdParamSchema), expenseController.remove);
expensesRouter.post('/:id/approve', csrfProtection, requirePermission('expenses:approve'), validate(expenseIdParamSchema), expenseController.approve);
expensesRouter.post('/:id/reject', csrfProtection, requirePermission('expenses:approve'), validate(expenseIdParamSchema), expenseController.reject);
expensesRouter.post('/:id/mark-paid', csrfProtection, requirePermission('expenses:update'), validate(expenseIdParamSchema), expenseController.markPaid);
