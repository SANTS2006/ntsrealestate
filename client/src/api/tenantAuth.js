import { apiClient } from './client.js';

// Every tenant has its own branded auth flow, namespaced by their URL slug
// (e.g. /acme-realty/login) — see server/src/routes/v1/tenantAuth.routes.js.
export const tenantAuthApi = {
  getBranding: (orgSlug) => apiClient.get(`/orgs/${orgSlug}/branding`),
  register: (orgSlug, body) => apiClient.post(`/orgs/${orgSlug}/auth/register`, body),
  login: (orgSlug, body) => apiClient.post(`/orgs/${orgSlug}/auth/login`, body),
  forgotPassword: (orgSlug, email) => apiClient.post(`/orgs/${orgSlug}/auth/forgot-password`, { email }),
  resetPassword: (orgSlug, body) => apiClient.post(`/orgs/${orgSlug}/auth/reset-password`, body),
};
