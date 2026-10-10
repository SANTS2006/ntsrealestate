import { apiClient } from './client.js';

export const dealsApi = {
  list: ({ page, pageSize, kind, status, search } = {}) => apiClient.get('/deals', { params: { page, pageSize, kind, status, search } }),
  get: (id) => apiClient.get(`/deals/${id}`),
  // A customer asks to rent / buy / lease a house, or to buy a land.
  request: (body) => apiClient.post('/deals/request', body),
  setStatus: (id, status) => apiClient.patch(`/deals/${id}/status`, { status }),
};
