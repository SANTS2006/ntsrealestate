import { apiClient } from './client.js';

export const propertiesApi = {
  list: ({ page, pageSize, search, status } = {}) =>
    apiClient.get('/properties', { params: { page, pageSize, search, status } }),
  get: (id) => apiClient.get(`/properties/${id}`),
  create: (body) => apiClient.post('/properties', body),
  update: (id, body) => apiClient.patch(`/properties/${id}`, body),
  archive: (id) => apiClient.delete(`/properties/${id}`),
  listAssignments: (id) => apiClient.get(`/properties/${id}/assignments`),
  assignStaff: (id, userId) => apiClient.post(`/properties/${id}/assignments`, { userId }),
  unassignStaff: (id, userId) => apiClient.delete(`/properties/${id}/assignments/${userId}`),
};
