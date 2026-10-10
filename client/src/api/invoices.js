import { apiClient } from './client.js';

export const invoicesApi = {
  list: ({ page, pageSize, status, tenantId, leaseId } = {}) =>
    apiClient.get('/invoices', { params: { page, pageSize, status, tenantId, leaseId } }),
  get: (id) => apiClient.get(`/invoices/${id}`),
  remove: (id) => apiClient.delete(`/invoices/${id}`),
  create: (body) => apiClient.post('/invoices', body),
  update: (id, body) => apiClient.patch(`/invoices/${id}`, body),
  send: (id) => apiClient.post(`/invoices/${id}/send`),
  void: (id, reason) => apiClient.post(`/invoices/${id}/void`, { reason }),
  generateFromLease: (leaseId, body) => apiClient.post(`/leases/${leaseId}/generate-invoice`, body),
};
