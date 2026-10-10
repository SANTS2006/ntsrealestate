import { findExpenseCategoriesByOrganization, createExpenseCategory } from '../repositories/expenseCategory.repository.js';
import { audit } from './audit.service.js';

export async function listExpenseCategories(organizationId) {
  const categories = await findExpenseCategoriesByOrganization(organizationId);
  return categories.map((c) => ({ id: c.id, name: c.name, description: c.description }));
}

export async function createExpenseCategoryRecord(organizationId, body, actingUser, req) {
  const category = await createExpenseCategory(organizationId, body.name, body.description);
  await audit({ organizationId, userId: actingUser.id, action: 'expense_category.created', entityType: 'expense_category', entityId: category.id, newValues: { name: category.name }, req });
  return { id: category.id, name: category.name, description: category.description };
}
