import { describe, it, expect, vi, beforeEach } from 'vitest';
import { importWithRetry, isChunkLoadError } from './lazyWithRetry.js';

const chunkError = () => new TypeError('Failed to fetch dynamically imported module: https://x/assets/Page-abc.js');

function stubBrowser() {
  const store = new Map();
  const reload = vi.fn();
  globalThis.window = { location: { reload } };
  globalThis.sessionStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  return { reload };
}

beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }); });

describe('isChunkLoadError', () => {
  it('recognises the browsers\' messages for a failed dynamic import', () => {
    expect(isChunkLoadError(chunkError())).toBe(true);
    expect(isChunkLoadError(new Error('error loading dynamically imported module'))).toBe(true);
    expect(isChunkLoadError(new Error('Importing a module script failed.'))).toBe(true);
    expect(isChunkLoadError(new Error('Loading chunk 12 failed.'))).toBe(true);
  });
  it('does not mistake ordinary errors for it', () => {
    expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
  });
});

describe('importWithRetry', () => {
  it('retries a transient failure and then succeeds without reloading', async () => {
    const { reload } = stubBrowser();
    const factory = vi.fn().mockRejectedValueOnce(chunkError()).mockResolvedValueOnce({ default: 'Page' });
    await expect(importWithRetry(factory)).resolves.toEqual({ default: 'Page' });
    expect(factory).toHaveBeenCalledTimes(2);
    expect(reload).not.toHaveBeenCalled();
  });

  it('does not retry or reload for an ordinary error in the page\'s own code', async () => {
    const { reload } = stubBrowser();
    const factory = vi.fn().mockRejectedValue(new Error('boom'));
    await expect(importWithRetry(factory)).rejects.toThrow('boom');
    expect(factory).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();
  });

  it('reloads exactly once for a missing chunk (new deploy), never in a loop', async () => {
    const { reload } = stubBrowser();
    const factory = vi.fn().mockRejectedValue(chunkError());
    const first = importWithRetry(factory, 2);
    // The first call parks (the page is reloading); give it time to reach the reload.
    await vi.advanceTimersByTimeAsync(5000);
    expect(reload).toHaveBeenCalledTimes(1);
    // A second failure inside the cooldown must surface as an error instead of reloading again.
    await expect(importWithRetry(factory, 2)).rejects.toThrow(/dynamically imported module/);
    expect(reload).toHaveBeenCalledTimes(1);
    void first;
  });
});
