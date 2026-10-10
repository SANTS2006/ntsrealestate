import { apiClient } from './client.js';

// Every function returns the server's `data` (see api/client.js's response
// interceptor, which unwraps the {success, data, message} envelope) or
// throws the normalized {code, message, statusCode, details} error shape.
//
// Registration, login, and forgot/reset-password moved to api/tenantAuth.js
// — every tenant has its own branded, slug-scoped version of each now (see
// server/src/routes/v1/tenantAuth.routes.js). What's left here all
// operates on an already-established session/token.
export const authApi = {
  verifyEmail: (token) => apiClient.post('/auth/verify-email', { token }),
  resendVerification: (email) => apiClient.post('/auth/resend-verification', { email }),
  mfaChallenge: (body) => apiClient.post('/auth/mfa/challenge', body),
  logout: () => apiClient.post('/auth/logout'),
  logoutAll: () => apiClient.post('/auth/logout-all'),
  setActiveRole: (role) => apiClient.post('/auth/active-role', { role }),
  me: () => apiClient.get('/auth/me'),
  changePassword: (body) => apiClient.post('/auth/change-password', body),
  mfaEnroll: () => apiClient.post('/auth/mfa/enroll'),
  mfaConfirm: (code) => apiClient.post('/auth/mfa/confirm', { code }),
  mfaDisable: (body) => apiClient.post('/auth/mfa/disable', body),
};
