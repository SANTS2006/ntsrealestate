import { apiClient } from './client.js';

export const landsApi = {
  list: ({ page, pageSize, search, status } = {}) => apiClient.get('/lands', { params: { page, pageSize, search, status } }),
  get: (id) => apiClient.get(`/lands/${id}`),
  create: (body) => apiClient.post('/lands', body),
  update: (id, body) => apiClient.patch(`/lands/${id}`, body),
  remove: (id) => apiClient.delete(`/lands/${id}`),
};
