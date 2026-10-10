import { prisma } from '../config/database.js';

export function createExpenseCategories(organizationId, names, tx = prisma) {
  return tx.expenseCategory.createMany({
    data: names.map((name) => ({ organizationId, name })),
    skipDuplicates: true,
  });
}

export function findExpenseCategoriesByOrganization(organizationId) {
  return prisma.expenseCategory.findMany({ where: { organizationId }, orderBy: { name: 'asc' } });
}

export function findExpenseCategoryById(id, organizationId) {
  return prisma.expenseCategory.findFirst({ where: { id, organizationId } });
}

export function createExpenseCategory(organizationId, name, description) {
  return prisma.expenseCategory.create({ data: { organizationId, name, description: description ?? null } });
}
