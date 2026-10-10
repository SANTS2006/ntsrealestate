import { apiClient } from './client.js';

export const tenantsApi = {
  list: ({ page, pageSize, search, status, unitId, buildingId } = {}) =>
    apiClient.get('/tenants', { params: { page, pageSize, search, status, unitId, buildingId } }),
  get: (id) => apiClient.get(`/tenants/${id}`),
  connections: (id) => apiClient.get(`/tenants/${id}/connections`),
  create: (body) => apiClient.post('/tenants', body),
  update: (id, body) => apiClient.patch(`/tenants/${id}`, body),
  setStatus: (id, status) => apiClient.patch(`/tenants/${id}/status`, { status }),
};
