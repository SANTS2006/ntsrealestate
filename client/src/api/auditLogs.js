import { apiClient } from './client.js';

export const auditLogsApi = {
  list: ({ page, pageSize, action, entityType, userId, from, to } = {}) =>
    apiClient.get('/audit-logs', { params: { page, pageSize, action, entityType, userId, from, to } }),
};
