import { describe, it, expect } from 'vitest';
import {
  signAccessToken, verifyAccessToken, signRefreshToken, verifyRefreshToken,
  signMfaChallengeToken, verifyMfaChallengeToken,
} from '../../../server/src/auth/jwt.js';

describe('access tokens', () => {
  it('round-trips claims through sign/verify', () => {
    const payload = verifyAccessToken(signAccessToken({ userId: 'u1', organizationId: 'o1', roles: ['administrator'] }));
    expect(payload.sub).toBe('u1');
    expect(payload.org).toBe('o1');
    expect(payload.roles).toEqual(['administrator']);
  });

  it('rejects a tampered token', () => {
    const token = signAccessToken({ userId: 'u1', organizationId: 'o1', roles: [] });
    const tampered = token.slice(0, -2) + (token.slice(-2) === 'AA' ? 'BB' : 'AA');
    expect(() => verifyAccessToken(tampered)).toThrow();
  });

  it('rejects a completely malformed token', () => {
    expect(() => verifyAccessToken('not.a.jwt')).toThrow();
  });
});

describe('refresh tokens', () => {
  it('round-trips claims through sign/verify', () => {
    const payload = verifyRefreshToken(signRefreshToken({ userId: 'u1', familyId: 'f1' }));
    expect(payload.sub).toBe('u1');
    expect(payload.fam).toBe('f1');
    expect(payload.type).toBe('refresh');
  });

  it('an access token is not accepted where a refresh token is expected (different secret)', () => {
    const accessToken = signAccessToken({ userId: 'u1', organizationId: 'o1', roles: [] });
    expect(() => verifyRefreshToken(accessToken)).toThrow();
  });
});

describe('MFA challenge tickets', () => {
  it('round-trips and carries the mfa_challenge purpose', () => {
    const payload = verifyMfaChallengeToken(signMfaChallengeToken('u1'));
    expect(payload.sub).toBe('u1');
    expect(payload.purpose).toBe('mfa_challenge');
  });

  it('a real access token is not accepted as an MFA challenge ticket', () => {
    const accessToken = signAccessToken({ userId: 'u1', organizationId: 'o1', roles: [] });
    expect(() => verifyMfaChallengeToken(accessToken)).toThrow();
  });
});
