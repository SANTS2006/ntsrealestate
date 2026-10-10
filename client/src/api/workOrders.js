import { apiClient } from './client.js';

export const workOrdersApi = {
  list: ({ page, pageSize, status, vendorId } = {}) =>
    apiClient.get('/work-orders', { params: { page, pageSize, status, vendorId } }),
  get: (id) => apiClient.get(`/work-orders/${id}`),
  update: (id, body) => apiClient.patch(`/work-orders/${id}`, body),
  start: (id) => apiClient.post(`/work-orders/${id}/start`),
  complete: (id, actualCost) => apiClient.post(`/work-orders/${id}/complete`, { actualCost }),
  cancel: (id) => apiClient.post(`/work-orders/${id}/cancel`),
  remove: (id) => apiClient.delete(`/work-orders/${id}`),
};
