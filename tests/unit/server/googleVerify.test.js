import { describe, it, expect, vi, beforeEach } from 'vitest';

// The Google token check: only a verified address, for OUR client id, is accepted.
const state = { payload: null, throws: false, seenAudience: null };
vi.mock('google-auth-library', () => ({
  OAuth2Client: class {
    async verifyIdToken({ audience }) {
      state.seenAudience = audience;
      if (state.throws) throw new Error('bad signature');
      return { getPayload: () => state.payload };
    }
  },
}));
vi.mock('../../../server/src/config/env.js', () => ({ env: { GOOGLE_CLIENT_ID: '123-abc.apps.googleusercontent.com' }, isProduction: false }));

const { verifyGoogleCredential } = await import('../../../server/src/auth/google.js');

describe('verifyGoogleCredential', () => {
  beforeEach(() => { state.throws = false; state.payload = { sub: '1001', email: 'Jane.Doe@Example.com', email_verified: true, given_name: 'Jane', family_name: 'Doe' }; });

  it('accepts a verified address, lowercases it, and checks our own client id', async () => {
    const g = await verifyGoogleCredential('x'.repeat(30));
    expect(g).toEqual({ sub: '1001', email: 'jane.doe@example.com', firstName: 'Jane', lastName: 'Doe' });
    expect(state.seenAudience).toBe('123-abc.apps.googleusercontent.com');
  });
  it('rejects an address Google has not verified', async () => {
    state.payload.email_verified = false;
    await expect(verifyGoogleCredential('x'.repeat(30))).rejects.toThrow(/not verified/i);
  });
  it('rejects a token that fails the library checks (signature, audience, expiry)', async () => {
    state.throws = true;
    await expect(verifyGoogleCredential('x'.repeat(30))).rejects.toThrow(/could not be verified/i);
  });
  it('rejects a token with no subject or email', async () => {
    state.payload = { email: 'a@b.com', email_verified: true };
    await expect(verifyGoogleCredential('x'.repeat(30))).rejects.toThrow(/could not be verified/i);
  });
  it('falls back to the display name when given/family names are missing', async () => {
    state.payload = { sub: '9', email: 'a@b.com', email_verified: true, name: 'Madonna Louise' };
    expect(await verifyGoogleCredential('x'.repeat(30))).toMatchObject({ firstName: 'Madonna', lastName: '' });
  });
});
