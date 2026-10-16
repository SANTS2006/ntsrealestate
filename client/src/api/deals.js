import { apiClient } from './client.js';

export const dealsApi = {
  list: ({ page, pageSize, kind, status, search } = {}) => apiClient.get('/deals', { params: { page, pageSize, kind, status, search } }),
  get: (id) => apiClient.get(`/deals/${id}`),
  // A customer asks to rent / buy / lease a house, or to buy a land.
  request: (body) => apiClient.post('/deals/request', body),
  // The rent / lease workflow after the request.
  setPlan: (id, body) => apiClient.put(`/deals/${id}/plan`, body),
  renew: (id, body = {}) => apiClient.post(`/deals/${id}/renew`, body),
  requestRenewal: (id) => apiClient.post(`/deals/${id}/renewal-request`),
  end: (id, body) => apiClient.post(`/deals/${id}/end`, body),
  setStatus: (id, status) => apiClient.patch(`/deals/${id}/status`, { status }),
};
