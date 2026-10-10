import { apiClient } from './client.js';

export const rolesApi = {
  list: () => apiClient.get('/roles'),
  get: (id) => apiClient.get(`/roles/${id}`),
  create: (body) => apiClient.post('/roles', body),
  update: (id, body) => apiClient.patch(`/roles/${id}`, body),
  remove: (id) => apiClient.delete(`/roles/${id}`),
  setPermissions: (id, permissionNames) => apiClient.put(`/roles/${id}/permissions`, { permissionNames }),
};
