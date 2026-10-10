import { chatApi } from './chatApi.js';
import { encryptFile, decryptFile } from './crypto.js';

// What may be attached, and how big. The server stores only ciphertext (25 MB
// cap, a little under it here to leave room for the encryption overhead); the
// type allowlist keeps decrypted files to formats the browser plays natively
// as <img>/<video>/<audio> — never as a page.
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
export const AUDIO_TYPES = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/x-m4a'];
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_MEDIA_BYTES = 24 * 1024 * 1024;

const baseType = (mime) => (mime ?? '').split(';')[0].trim().toLowerCase();

export function kindOf(mime) {
  const t = baseType(mime);
  if (IMAGE_TYPES.includes(t)) return 'image';
  if (VIDEO_TYPES.includes(t)) return 'video';
  if (AUDIO_TYPES.includes(t)) return 'voice';
  return null;
}

export function validateFile(file) {
  const kind = kindOf(file.type);
  if (!kind || kind === 'voice') return { error: 'Choose a picture (JPG, PNG, WebP, GIF) or a video (MP4, WebM, MOV).' };
  if (kind === 'image' && file.size > MAX_IMAGE_BYTES) return { error: 'Pictures can be up to 10 MB.' };
  if (file.size > MAX_MEDIA_BYTES) return { error: 'Videos can be up to 24 MB. Try a shorter clip.' };
  return { kind };
}

// Encrypts `blob` on this device, uploads the ciphertext, and returns the
// payload (carrying the file's key) to put inside an encrypted message plus
// the attachment id.
export async function uploadEncrypted(roomId, blob, { kind, name, mime, duration }) {
  const { cipher, key, iv } = await encryptFile(await blob.arrayBuffer());
  const res = await chatApi.uploadAttachment(roomId, cipher);
  return {
    attachmentId: res.data.id,
    payload: { t: kind, name, mime: baseType(mime), size: blob.size, key, iv, ...(duration ? { duration } : {}) },
  };
}

// Downloads and decrypts an attachment into a playable object URL. Results
// are cached for the life of the page so scrolling doesn't refetch.
const cache = new Map();

export function openAttachment(attachmentId, payload) {
  if (!cache.has(attachmentId)) {
    cache.set(attachmentId, (async () => {
      const cipher = await chatApi.downloadAttachment(attachmentId);
      const bytes = await decryptFile(cipher, payload.key, payload.iv);
      return URL.createObjectURL(new Blob([bytes], { type: baseType(payload.mime) }));
    })().catch((err) => { cache.delete(attachmentId); throw err; }));
  }
  return cache.get(attachmentId);
}

export function formatDuration(seconds) {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
