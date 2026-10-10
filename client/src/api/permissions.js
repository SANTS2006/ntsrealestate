import { apiClient } from './client.js';

export const permissionsApi = {
  list: () => apiClient.get('/permissions'),
  create: (body) => apiClient.post('/permissions', body),
  update: (id, body) => apiClient.patch(`/permissions/${id}`, body),
  remove: (id) => apiClient.delete(`/permissions/${id}`),
};
