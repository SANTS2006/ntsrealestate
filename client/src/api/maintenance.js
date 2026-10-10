import { apiClient } from './client.js';

export const maintenanceApi = {
  list: ({ page, pageSize, status, priority, propertyId, tenantId } = {}) =>
    apiClient.get('/maintenance', { params: { page, pageSize, status, priority, propertyId, tenantId } }),
  get: (id) => apiClient.get(`/maintenance/${id}`),
  create: (body) => apiClient.post('/maintenance', body),
  review: (id) => apiClient.post(`/maintenance/${id}/review`),
  assign: (id, vendorId) => apiClient.post(`/maintenance/${id}/assign`, { vendorId }),
  vendors: (id) => apiClient.get(`/maintenance/${id}/vendors`),
  cancel: (id) => apiClient.post(`/maintenance/${id}/cancel`),
  remove: (id) => apiClient.delete(`/maintenance/${id}`),
  listWorkOrders: (maintenanceRequestId) => apiClient.get(`/maintenance/${maintenanceRequestId}/work-orders`),
  createWorkOrder: (maintenanceRequestId, body) => apiClient.post(`/maintenance/${maintenanceRequestId}/work-orders`, body),
};
