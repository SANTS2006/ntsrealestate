import { authenticator } from 'otplib';
import crypto from 'node:crypto';
import { encryptSecret, decryptSecret, hashToken } from './crypto.js';

authenticator.options = { window: 1 }; // ±1 step (30s) clock-skew tolerance

export function generateTotpSecret() {
  return authenticator.generateSecret();
}

export function buildOtpAuthUrl(secret, email, issuer = 'NTS Real Estate System') {
  return authenticator.keyuri(email, issuer, secret);
}

export function encryptTotpSecret(secret) {
  return encryptSecret(secret);
}

export function verifyTotpCode(encryptedSecret, code) {
  if (!/^\d{6}$/.test(code ?? '')) return false;
  const secret = decryptSecret(encryptedSecret);
  return authenticator.verify({ token: code, secret });
}

// Recovery codes are shown once at generation time, then only their hash is
// stored — same principle as password-reset tokens.
export function generateRecoveryCodes(count = 8) {
  const codes = [];
  for (let i = 0; i < count; i += 1) {
    const code = crypto.randomBytes(5).toString('hex'); // 10 hex chars, grouped for readability
    codes.push(`${code.slice(0, 5)}-${code.slice(5)}`);
  }
  return codes;
}

export function hashRecoveryCode(code) {
  return hashToken(code.toLowerCase().replace(/-/g, ''));
}
