import { randomInt } from 'node:crypto';
import { findUserByReferralCode } from '../repositories/user.repository.js';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I — avoids look-alike codes read aloud or typed
const SUFFIX_LENGTH = 5;

function randomSuffix() {
  let out = '';
  for (let i = 0; i < SUFFIX_LENGTH; i += 1) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

// Readable-ish (first three letters of the first name + a random suffix)
// rather than a raw UUID slice — this is meant to be spoken/typed by a
// tenant sharing it with a friend, not just machine-readable. Retries on
// the rare collision; falls back to a longer suffix if the namespace is
// somehow saturated for that name prefix.
export async function generateUniqueReferralCode(firstName) {
  const prefix = (firstName || 'USER').replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase().padEnd(3, 'X');
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = `${prefix}-${randomSuffix()}`;
    const existing = await findUserByReferralCode(candidate);
    if (!existing) return candidate;
  }
  // Namespace exhaustion is effectively impossible (33^5 combinations per
  // prefix) — this is just a safe terminal fallback, not an expected path.
  return `${prefix}-${randomSuffix()}${randomSuffix()}`;
}
