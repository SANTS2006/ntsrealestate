import { apiClient } from './client.js';

export const reportsApi = {
  financialSummary: ({ propertyId, from, to } = {}) =>
    apiClient.get('/reports/financial-summary', { params: { propertyId, from, to } }),
  occupancy: ({ propertyId } = {}) =>
    apiClient.get('/reports/occupancy', { params: { propertyId } }),
  rentCollection: ({ propertyId, from, to } = {}) =>
    apiClient.get('/reports/rent-collection', { params: { propertyId, from, to } }),
  maintenanceSummary: ({ propertyId } = {}) =>
    apiClient.get('/reports/maintenance-summary', { params: { propertyId } }),
};
