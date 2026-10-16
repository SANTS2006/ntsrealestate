import { describe, it, expect, vi, beforeEach } from 'vitest';

// Links in emails must never point at localhost in production.
const state = { env: { CLIENT_URL: 'http://localhost:5173' }, isProduction: true };
vi.mock('../../../server/src/config/env.js', () => ({
  get env() { return state.env; },
  get isProduction() { return state.isProduction; },
}));

const { appBaseUrl, requestOriginMiddleware } = await import('../../../server/src/utils/appUrl.js');
const withRequest = (host, protocol = 'https') => new Promise((resolve) => {
  requestOriginMiddleware({ get: () => host, protocol }, {}, () => resolve(appBaseUrl()));
});

describe('appBaseUrl', () => {
  beforeEach(() => { delete process.env.RENDER_EXTERNAL_URL; state.isProduction = true; state.env = { CLIENT_URL: 'http://localhost:5173' }; });

  it('uses CLIENT_URL when it is a real address', async () => {
    state.env = { CLIENT_URL: 'https://app.example.com/' };
    expect(await withRequest('other.example.com')).toBe('https://app.example.com');
  });
  it('ignores a CLIENT_URL left at localhost in production and uses the host\'s own address', async () => {
    process.env.RENDER_EXTERNAL_URL = 'https://ntsrealestate.onrender.com';
    expect(await withRequest('anything.example.com')).toBe('https://ntsrealestate.onrender.com');
  });
  it('falls back to the address the request came in on', async () => {
    expect(await withRequest('ntsrealestate.onrender.com')).toBe('https://ntsrealestate.onrender.com');
  });
  it('keeps localhost in development', async () => {
    state.isProduction = false;
    expect(await withRequest('localhost:5000', 'http')).toBe('http://localhost:5173');
  });
});
