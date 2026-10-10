import { describe, it, expect } from 'vitest';
import { encryptSecret, decryptSecret, hashToken, generateRawToken } from '../../../server/src/auth/crypto.js';

describe('MFA secret encryption (AES-256-GCM)', () => {
  it('round-trips: decrypting an encrypted secret returns the original plaintext', () => {
    const secret = 'JBSWY3DPEHPK3PXP';
    expect(decryptSecret(encryptSecret(secret))).toBe(secret);
  });

  it('produces a different ciphertext each time (random IV) for the same plaintext', () => {
    const secret = 'JBSWY3DPEHPK3PXP';
    expect(encryptSecret(secret)).not.toBe(encryptSecret(secret));
  });

  it('fails to decrypt a tampered ciphertext (authenticated encryption)', () => {
    const packed = encryptSecret('JBSWY3DPEHPK3PXP');
    const buf = Buffer.from(packed, 'base64');
    buf[buf.length - 1] ^= 0xff; // flip the last byte of the ciphertext
    expect(() => decryptSecret(buf.toString('base64'))).toThrow();
  });
});

describe('one-way token hashing', () => {
  it('is deterministic for the same input', () => {
    expect(hashToken('same-token')).toBe(hashToken('same-token'));
  });

  it('differs for different inputs', () => {
    expect(hashToken('token-a')).not.toBe(hashToken('token-b'));
  });
});

describe('generateRawToken', () => {
  it('generates a different token on every call', () => {
    expect(generateRawToken()).not.toBe(generateRawToken());
  });

  it('generates a URL-safe token with meaningful entropy', () => {
    const token = generateRawToken();
    expect(token.length).toBeGreaterThan(30);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
