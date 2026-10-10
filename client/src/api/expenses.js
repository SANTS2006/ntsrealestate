import { apiClient } from './client.js';

export const expensesApi = {
  list: ({ page, pageSize, status, propertyId, categoryId } = {}) =>
    apiClient.get('/expenses', { params: { page, pageSize, status, propertyId, categoryId } }),
  get: (id) => apiClient.get(`/expenses/${id}`),
  remove: (id) => apiClient.delete(`/expenses/${id}`),
  create: (body) => apiClient.post('/expenses', body),
  approve: (id) => apiClient.post(`/expenses/${id}/approve`),
  reject: (id) => apiClient.post(`/expenses/${id}/reject`),
  markPaid: (id) => apiClient.post(`/expenses/${id}/mark-paid`),
  listCategories: () => apiClient.get('/expenses/categories'),
  createCategory: (body) => apiClient.post('/expenses/categories', body),
};
