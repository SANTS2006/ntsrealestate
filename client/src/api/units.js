import { apiClient } from './client.js';

export const unitsApi = {
  list: (buildingId, { status } = {}) => apiClient.get(`/buildings/${buildingId}/units`, { params: { status } }),
  get: (id) => apiClient.get(`/units/${id}`),
  create: (buildingId, body) => apiClient.post(`/buildings/${buildingId}/units`, body),
  update: (id, body) => apiClient.patch(`/units/${id}`, body),
  setStatus: (id, status) => apiClient.patch(`/units/${id}/status`, { status }),
  endRental: (id) => apiClient.post(`/units/${id}/end-rental`),
  remove: (id) => apiClient.delete(`/units/${id}`),
};
