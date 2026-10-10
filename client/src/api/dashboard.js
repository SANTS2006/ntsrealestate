import { apiClient } from './client.js';

export const dashboardApi = {
  get: () => apiClient.get('/dashboard'),
};
