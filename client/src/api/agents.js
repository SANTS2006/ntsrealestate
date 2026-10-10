import { apiClient } from './client.js';

export const agentsApi = {
  list: () => apiClient.get('/agents'),
  add: (body) => apiClient.post('/agents', body),
  update: (linkId, body) => apiClient.patch(`/agents/${linkId}`, body),
  setStatus: (linkId, status) => apiClient.patch(`/agents/${linkId}/status`, { status }),
  remove: (linkId) => apiClient.delete(`/agents/${linkId}`),
};
