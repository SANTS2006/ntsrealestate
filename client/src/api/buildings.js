import { apiClient } from './client.js';

export const buildingsApi = {
  list: (propertyId) => apiClient.get(`/properties/${propertyId}/buildings`),
  get: (id) => apiClient.get(`/buildings/${id}`),
  create: (propertyId, body) => apiClient.post(`/properties/${propertyId}/buildings`, body),
  update: (id, body) => apiClient.patch(`/buildings/${id}`, body),
  remove: (id) => apiClient.delete(`/buildings/${id}`),
};
