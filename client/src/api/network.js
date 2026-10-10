import { apiClient } from './client.js';

export const networkApi = {
  get: () => apiClient.get('/network'),
};
