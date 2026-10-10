import { apiClient } from './client.js';

export const referralsApi = {
  list: ({ page, pageSize, status } = {}) => apiClient.get('/referrals', { params: { page, pageSize, status } }),
  approve: (id, bonusAmount) => apiClient.post(`/referrals/${id}/approve`, { bonusAmount }),
  markPaid: (id) => apiClient.post(`/referrals/${id}/mark-paid`),
};
