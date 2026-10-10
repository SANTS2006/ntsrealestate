import crypto from 'node:crypto';
import { env } from '../config/env.js';

// Symmetric encryption for data that must be *decrypted* later (TOTP secrets)
// — distinct from one-way hashing used for passwords/tokens. AES-256-GCM
// gives us authenticated encryption (tamper-evident), not just confidentiality.
const ALGORITHM = 'aes-256-gcm';
const key = Buffer.from(env.MFA_ENCRYPTION_KEY, 'hex');

export function encryptSecret(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Pack iv:authTag:ciphertext as a single base64 string for storage.
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

export function decryptSecret(packed) {
  const buf = Buffer.from(packed, 'base64');
  const iv = buf.subarray(0, 12);
  const authTag = buf.subarray(12, 28);
  const encrypted = buf.subarray(28);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

// One-way SHA-256 for tokens we only ever need to *compare*, never recover
// (email verification, password reset, refresh tokens, MFA recovery codes).
// A random 256-bit token already has enough entropy that a plain fast hash
// is fine here — unlike passwords, these aren't user-chosen/low-entropy.
export function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export function generateRawToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}
