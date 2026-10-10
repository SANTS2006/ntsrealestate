import { apiClient } from '../api/client.js';

// Thin wrappers over /chat — everything sent or received here is ciphertext
// or public/wrapped key material; plaintext never leaves the browser.
//
// A conversation is many small requests that each re-check who you are, so
// they get a more patient timeout than the rest of the app (a request that
// the server did complete should not be reported as a failure).
const T = { timeout: 45_000 };

export const chatApi = {
  getKeys: () => apiClient.get('/chat/keys/me', T),
  saveKeys: (body) => apiClient.put('/chat/keys/me', body, T),
  iceServers: () => apiClient.get('/chat/ice-servers', T),
  directory: () => apiClient.get('/chat/directory', T),

  rooms: () => apiClient.get('/chat/rooms', T),
  room: (roomId) => apiClient.get(`/chat/rooms/${roomId}`, T),
  openDirect: (ref) => apiClient.post('/chat/rooms/direct', { ref }, T),
  distributeKeys: (roomId, keys) => apiClient.put(`/chat/rooms/${roomId}/keys`, { keys }, T),
  messages: (roomId, { before, limit } = {}) => apiClient.get(`/chat/rooms/${roomId}/messages`, { params: { before, limit }, ...T }),
  send: (roomId, body) => apiClient.post(`/chat/rooms/${roomId}/messages`, body, T),
  markRead: (roomId) => apiClient.post(`/chat/rooms/${roomId}/read`, undefined, T),

  // Files can be large: no timeout at all.
  uploadAttachment: (roomId, cipher) =>
    apiClient.post(`/chat/rooms/${roomId}/attachments`, cipher, { headers: { 'Content-Type': 'application/octet-stream' }, maxBodyLength: Infinity, timeout: 0 }),
  downloadAttachment: (attachmentId) => apiClient.get(`/chat/attachments/${attachmentId}`, { responseType: 'arraybuffer', timeout: 0 }),
};
