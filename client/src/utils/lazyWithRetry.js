import { createElement, lazy } from 'react';

// React.lazy remembers a failed import for the life of the page, so one
// dropped connection — or a deploy that replaced the old chunk files —
// leaves that route broken until a manual refresh. This wrapper:
//   1. retries the import a couple of times (transient network blips);
//   2. if the files are really gone (new deploy), reloads ONCE to pick up the
//      new index.html — guarded so it can never loop;
//   3. otherwise throws, and the ErrorBoundary shows a "Try again" screen.
// `resetLazyRoutes()` (called by the boundary's Try again) drops the cached
// failure so the next render attempts the import afresh.

const resets = new Set();
const RELOAD_KEY = 'nts.chunkReloadAt';
const RELOAD_COOLDOWN_MS = 60_000;

export function isChunkLoadError(error) {
  const text = `${error?.name ?? ''} ${error?.message ?? ''}`;
  return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Loading chunk [\w-]+ failed|Loading CSS chunk|ChunkLoadError|Unable to preload CSS/i.test(text);
}

function reloadOnceForNewDeploy() {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last < RELOAD_COOLDOWN_MS) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    return false; // storage unavailable: never risk a reload loop
  }
  window.location.reload();
  return true;
}

export async function importWithRetry(factory, attempts = 3) {
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await factory();
    } catch (err) {
      lastError = err;
      if (!isChunkLoadError(err)) throw err;
      await new Promise((resolve) => setTimeout(resolve, 400 * (i + 1)));
    }
  }
  if (isChunkLoadError(lastError) && typeof window !== 'undefined' && reloadOnceForNewDeploy()) {
    // The page is reloading; keep the Suspense fallback up meanwhile.
    return new Promise(() => {});
  }
  throw lastError;
}

export function resetLazyRoutes() {
  resets.forEach((reset) => reset());
}

export function lazyWithRetry(factory) {
  const make = () => lazy(() => importWithRetry(factory));
  let Inner = make();
  resets.add(() => { Inner = make(); });
  return function LazyRoute(props) {
    return createElement(Inner, props);
  };
}
