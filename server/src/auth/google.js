import { OAuth2Client } from 'google-auth-library';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

let client;

// Checks a Google ID token ("credential") the browser received: signed by
// Google, issued for OUR client id, not expired. Only an address Google itself
// has verified is accepted. Never trust anything about the person from the
// browser except this verified token.
export async function verifyGoogleCredential(credential) {
  if (!env.GOOGLE_CLIENT_ID) throw AppError.badRequest('Sign in with Google is not set up for this system.');
  client ??= new OAuth2Client(env.GOOGLE_CLIENT_ID);
  let payload;
  try {
    const ticket = await client.verifyIdToken({ idToken: credential, audience: env.GOOGLE_CLIENT_ID });
    payload = ticket.getPayload();
  } catch {
    throw AppError.unauthorized('Google sign-in could not be verified. Please try again.');
  }
  if (!payload?.sub || !payload.email) throw AppError.unauthorized('Google sign-in could not be verified. Please try again.');
  if (payload.email_verified !== true) throw AppError.unauthorized('Your Google email address is not verified.');
  return {
    sub: String(payload.sub),
    email: String(payload.email).toLowerCase(),
    firstName: payload.given_name || String(payload.name ?? '').split(' ')[0] || 'Google',
    lastName: payload.family_name || '',
  };
}
