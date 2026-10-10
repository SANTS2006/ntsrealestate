import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { parsePagination } from '../utils/pagination.js';
import * as expenseService from '../services/expense.service.js';
import * as expenseCategoryService from '../services/expenseCategory.service.js';

export const list = asyncHandler(async (req, res) => {
  const { page, pageSize, skip, take } = parsePagination(req.query);
  const result = await expenseService.listExpenses(req.user.organizationId, req.user, {
    page, pageSize, skip, take, status: req.query.status, propertyId: req.query.propertyId, categoryId: req.query.categoryId,
  });
  sendSuccess(res, { data: result.expenses, meta: result.meta });
});

export const get = asyncHandler(async (req, res) => {
  const expense = await expenseService.getExpense(req.params.id, req.user.organizationId, req.user);
  sendSuccess(res, { data: expense });
});

export const create = asyncHandler(async (req, res) => {
  const expense = await expenseService.createExpenseRecord(req.user.organizationId, req.body, req.user, req);
  sendSuccess(res, { statusCode: 201, data: expense, message: 'Expense submitted for approval.' });
});

export const approve = asyncHandler(async (req, res) => {
  const expense = await expenseService.approveExpense(req.params.id, req.user.organizationId, req.user, req);
  sendSuccess(res, { data: expense, message: 'Expense approved.' });
});

export const reject = asyncHandler(async (req, res) => {
  const expense = await expenseService.rejectExpense(req.params.id, req.user.organizationId, req.user, req);
  sendSuccess(res, { data: expense, message: 'Expense rejected.' });
});

export const markPaid = asyncHandler(async (req, res) => {
  const expense = await expenseService.markExpensePaid(req.params.id, req.user.organizationId, req.user, req);
  sendSuccess(res, { data: expense, message: 'Expense marked as paid.' });
});

export const listCategories = asyncHandler(async (req, res) => {
  const categories = await expenseCategoryService.listExpenseCategories(req.user.organizationId);
  sendSuccess(res, { data: categories });
});

export const createCategory = asyncHandler(async (req, res) => {
  const category = await expenseCategoryService.createExpenseCategoryRecord(req.user.organizationId, req.body, req.user, req);
  sendSuccess(res, { statusCode: 201, data: category, message: 'Expense category created.' });
});

export const remove = asyncHandler(async (req, res) => {
  await expenseService.deleteExpense(req.params.id, req.user.organizationId, req.user, req);
  sendSuccess(res, { data: null, message: 'Expense deleted.' });
});
