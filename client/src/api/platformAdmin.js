import { apiClient } from './client.js';

export const platformAdminApi = {
  login: (body) => apiClient.post('/platform-admin/auth/login', body),
  logout: () => apiClient.post('/platform-admin/auth/logout'),
  me: () => apiClient.get('/platform-admin/auth/me'),
  forgotPassword: (email) => apiClient.post('/platform-admin/auth/forgot-password', { email }),
  resetPassword: (body) => apiClient.post('/platform-admin/auth/reset-password', body),
  changePassword: (body) => apiClient.post('/platform-admin/auth/change-password', body),
  mfaChallenge: (body) => apiClient.post('/platform-admin/auth/mfa/challenge', body),
  mfaEnroll: () => apiClient.post('/platform-admin/auth/mfa/enroll'),
  mfaConfirm: (code) => apiClient.post('/platform-admin/auth/mfa/confirm', { code }),
  mfaDisable: (body) => apiClient.post('/platform-admin/auth/mfa/disable', body),
  resetAdminMfa: (id) => apiClient.post(`/platform-admin/admins/${id}/mfa/reset`),
  uploadAvatar: (file) => {
    const formData = new FormData();
    formData.append('avatar', file);
    return apiClient.post('/platform-admin/auth/avatar', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  removeAvatar: () => apiClient.delete('/platform-admin/auth/avatar'),
  updateProfile: (body) => apiClient.patch('/platform-admin/auth/profile', body),

  overview: () => apiClient.get('/platform-admin/overview'),
  getMaintenance: () => apiClient.get('/platform-admin/maintenance'),
  setMaintenance: (body) => apiClient.put('/platform-admin/maintenance', body),

  backupStatus: () => apiClient.get('/platform-admin/backups/status'),
  listBackups: (params) => apiClient.get('/platform-admin/backups', { params }),
  createBackup: () => apiClient.post('/platform-admin/backups'),
  verifyBackup: (id) => apiClient.post(`/platform-admin/backups/${id}/verify`),
  deleteBackup: (id) => apiClient.delete(`/platform-admin/backups/${id}`),
  prepareRestore: (backupId) => apiClient.post('/platform-admin/backups/restores/prepare', { backupId }),
  startRestore: (body) => apiClient.post('/platform-admin/backups/restores', body),
  listRestores: (params) => apiClient.get('/platform-admin/backups/restores', { params }),
  getRestore: (id) => apiClient.get(`/platform-admin/backups/restores/${id}`),

  listOrganizations: () => apiClient.get('/platform-admin/organizations'),
  getOrganization: (id) => apiClient.get(`/platform-admin/organizations/${id}`),
  createOrganization: (formData) =>
    apiClient.post('/platform-admin/organizations', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  updateOrganization: (id, body) => apiClient.patch(`/platform-admin/organizations/${id}`, body),
  setOrganizationStatus: (id, status) => apiClient.patch(`/platform-admin/organizations/${id}/status`, { status }),
  sendOrganizationAdminReset: (id, userId) => apiClient.post(`/platform-admin/organizations/${id}/send-admin-reset`, { userId }),

  listAdmins: () => apiClient.get('/platform-admin/admins'),
  createAdmin: (body) => apiClient.post('/platform-admin/admins', body),
  deleteAdmin: (id) => apiClient.delete(`/platform-admin/admins/${id}`),
  auditLogs: (params) => apiClient.get('/platform-admin/audit-logs', { params }),
  replaceOrganizationLogo: (id, file) => {
    const formData = new FormData();
    formData.append('logo', file);
    return apiClient.post(`/platform-admin/organizations/${id}/logo`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  setAdminActive: (id, isActive) => apiClient.patch(`/platform-admin/admins/${id}/status`, { isActive }),
};
