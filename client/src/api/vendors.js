import { apiClient } from './client.js';

export const vendorsApi = {
  list: ({ page, pageSize, search, status, serviceType } = {}) =>
    apiClient.get('/vendors', { params: { page, pageSize, search, status, serviceType } }),
  get: (id) => apiClient.get(`/vendors/${id}`),
  create: (body) => apiClient.post('/vendors', body),
  update: (id, body) => apiClient.patch(`/vendors/${id}`, body),
  setStatus: (id, status) => apiClient.patch(`/vendors/${id}/status`, { status }),
  remove: (id) => apiClient.delete(`/vendors/${id}`),
};
