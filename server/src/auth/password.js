import argon2 from 'argon2';
import { AppError } from '../utils/AppError.js';

// Argon2id — the OWASP-recommended variant (hybrid resistance to both GPU
// cracking and side-channel attacks), tuned parameters below the
// memory-heavy defaults are intentionally conservative for a typical API
// server's memory budget under concurrent logins.
const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456, // ~19 MB
  timeCost: 2,
  parallelism: 1,
};

export async function hashPassword(plainPassword) {
  return argon2.hash(plainPassword, ARGON2_OPTIONS);
}

export async function verifyPassword(hash, plainPassword) {
  try {
    return await argon2.verify(hash, plainPassword);
  } catch {
    // Malformed hash, algorithm mismatch, etc. — never let this bubble as a
    // 500; treat it the same as "password did not match."
    return false;
  }
}

const COMMON_PASSWORDS = new Set([
  'password', 'password123', '12345678', 'qwerty123', 'letmein123',
  'welcome123', 'admin1234', 'iloveyou1', 'passw0rd1', 'football1',
]);

// Server-side policy enforcement — the client's own validation (Zod, in
// client/src/validations) is a UX convenience only and is never trusted.
export function assertPasswordPolicy(password, { email, firstName, lastName } = {}) {
  const issues = [];
  if (password.length < 12) issues.push('Password must be at least 12 characters long.');
  if (password.length > 128) issues.push('Password must be no more than 128 characters long.');
  if (!/[a-z]/.test(password)) issues.push('Password must include a lowercase letter.');
  if (!/[A-Z]/.test(password)) issues.push('Password must include an uppercase letter.');
  if (!/[0-9]/.test(password)) issues.push('Password must include a number.');
  if (COMMON_PASSWORDS.has(password.toLowerCase())) issues.push('This password is too common. Please choose another.');

  const lowerPassword = password.toLowerCase();
  const localPart = email?.split('@')[0]?.toLowerCase();
  if (localPart && localPart.length >= 4 && lowerPassword.includes(localPart)) {
    issues.push('Password must not contain your email address.');
  }
  if (firstName && firstName.length >= 3 && lowerPassword.includes(firstName.toLowerCase())) {
    issues.push('Password must not contain your first name.');
  }
  if (lastName && lastName.length >= 3 && lowerPassword.includes(lastName.toLowerCase())) {
    issues.push('Password must not contain your last name.');
  }

  if (issues.length > 0) {
    throw AppError.validation('Password does not meet the security policy.', issues.map((message) => ({ path: 'password', message })));
  }
}
