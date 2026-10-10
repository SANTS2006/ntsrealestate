import { apiClient } from './client.js';

export const auditRemarksApi = {
  list: ({ page, pageSize } = {}) => apiClient.get('/audit-remarks', { params: { page, pageSize } }),
  create: (content) => apiClient.post('/audit-remarks', { content }),
};
