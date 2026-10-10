import { apiClient } from './client.js';

export const leasesApi = {
  list: ({ page, pageSize, status, tenantId, unitId } = {}) =>
    apiClient.get('/leases', { params: { page, pageSize, status, tenantId, unitId } }),
  get: (id) => apiClient.get(`/leases/${id}`),
  create: (body) => apiClient.post('/leases', body),
  update: (id, body) => apiClient.patch(`/leases/${id}`, body),
  activate: (id) => apiClient.post(`/leases/${id}/activate`),
  terminate: (id, reason) => apiClient.post(`/leases/${id}/terminate`, { reason }),
  renew: (id, body) => apiClient.post(`/leases/${id}/renew`, body),
};
