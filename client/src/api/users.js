import { apiClient } from './client.js';

export const usersApi = {
  list: ({ page, pageSize, search, status } = {}) =>
    apiClient.get('/users', { params: { page, pageSize, search, status } }),
  get: (id) => apiClient.get(`/users/${id}`),
  invite: (body) => apiClient.post('/users/invite', body),
  updateStatus: (id, status) => apiClient.patch(`/users/${id}/status`, { status }),
  remove: (id) => apiClient.delete(`/users/${id}`),
  addRole: (id, role) => apiClient.post(`/users/${id}/roles`, { role }),
  removeRole: (id, role) => apiClient.delete(`/users/${id}/roles/${role}`),
  updateRole: (id, role) => apiClient.patch(`/users/${id}/role`, { role }),
};
