import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, assertPasswordPolicy } from '../../../server/src/auth/password.js';

describe('password policy', () => {
  it('accepts a strong, unrelated password', () => {
    expect(() => assertPasswordPolicy('Correct-Horse-Battery9', { email: 'user@example.com' })).not.toThrow();
  });

  it('rejects a password shorter than 12 characters', () => {
    expect(() => assertPasswordPolicy('Short1A', {})).toThrow();
  });

  it('rejects a password missing an uppercase letter', () => {
    expect(() => assertPasswordPolicy('lowercase-only-123', {})).toThrow();
  });

  it('rejects a password missing a digit', () => {
    expect(() => assertPasswordPolicy('NoDigitsHereAtAll', {})).toThrow();
  });

  it('rejects a common password', () => {
    expect(() => assertPasswordPolicy('Password123', {})).toThrow();
  });

  it('rejects a password containing the user\'s email local part', () => {
    expect(() => assertPasswordPolicy('adaowner-Secure99', { email: 'adaowner@example.com' })).toThrow();
  });

  it('rejects a password containing the user\'s first or last name', () => {
    expect(() => assertPasswordPolicy('JohnathanSecure99', { firstName: 'Johnathan' })).toThrow();
  });
});

describe('argon2id hashing', () => {
  it('round-trips: verifyPassword returns true for the original password', async () => {
    const hash = await hashPassword('Correct-Horse-Battery9');
    await expect(verifyPassword(hash, 'Correct-Horse-Battery9')).resolves.toBe(true);
  });

  it('rejects an incorrect password against a real hash', async () => {
    const hash = await hashPassword('Correct-Horse-Battery9');
    await expect(verifyPassword(hash, 'wrong-password')).resolves.toBe(false);
  });

  it('never throws on a malformed hash — treats it as a non-match', async () => {
    await expect(verifyPassword('not-a-real-hash', 'anything')).resolves.toBe(false);
  });
});
