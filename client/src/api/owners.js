import { apiClient } from './client.js';

export const ownersApi = {
  list: ({ page, pageSize, search, status } = {}) =>
    apiClient.get('/owners', { params: { page, pageSize, search, status } }),
  // Names only — for dropdowns; much lighter than the full list.
  options: () => apiClient.get('/owners/options', { timeout: 45_000 }),
  get: (id) => apiClient.get(`/owners/${id}`),
  connections: (id) => apiClient.get(`/owners/${id}/connections`),
  create: (body) => apiClient.post('/owners', body),
  update: (id, body) => apiClient.patch(`/owners/${id}`, body),
  setStatus: (id, status) => apiClient.patch(`/owners/${id}/status`, { status }),
};
