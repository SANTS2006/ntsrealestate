import { apiClient } from './client.js';

export const rentalsApi = {
  request: (body) => apiClient.post('/rentals', body),
  mine: () => apiClient.get('/rentals/mine'),
  scopeOptions: () => apiClient.get('/rentals/scope-options'),
  // Public (no sign-in): a listing's basic details for the rent screen.
  publicListing: (orgSlug, unitId) => apiClient.get(`/public/orgs/${orgSlug}/listings/${unitId}`),
  publicLand: (orgSlug, landId) => apiClient.get(`/public/orgs/${orgSlug}/lands/${landId}`),
};
