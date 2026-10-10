import { apiClient } from './client.js';

export const paymentsApi = {
  list: ({ page, pageSize, status, tenantId, invoiceId } = {}) =>
    apiClient.get('/payments', { params: { page, pageSize, status, tenantId, invoiceId } }),
  get: (id) => apiClient.get(`/payments/${id}`),
  create: (body) => apiClient.post('/payments', body),
  refund: (id, reason) => apiClient.post(`/payments/${id}/refund`, { reason }),
};
