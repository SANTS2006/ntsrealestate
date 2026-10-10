import { apiClient } from './client.js';

export const notificationsApi = {
  list: ({ page, pageSize, unreadOnly, all } = {}) =>
    apiClient.get('/notifications', { params: { page, pageSize, unreadOnly, all } }),
  get: (id) => apiClient.get(`/notifications/${id}`),
  markRead: (id) => apiClient.post(`/notifications/${id}/read`),
  markAllRead: () => apiClient.post('/notifications/read-all'),
};
