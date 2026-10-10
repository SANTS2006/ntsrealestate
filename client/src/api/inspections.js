import { apiClient } from './client.js';

export const inspectionsApi = {
  list: ({ page, pageSize, status, type, propertyId } = {}) =>
    apiClient.get('/inspections', { params: { page, pageSize, status, type, propertyId } }),
  get: (id) => apiClient.get(`/inspections/${id}`),
  schedule: (body) => apiClient.post('/inspections', body),
  update: (id, body) => apiClient.patch(`/inspections/${id}`, body),
  complete: (id, body) => apiClient.post(`/inspections/${id}/complete`, body),
  cancel: (id) => apiClient.post(`/inspections/${id}/cancel`),
};
