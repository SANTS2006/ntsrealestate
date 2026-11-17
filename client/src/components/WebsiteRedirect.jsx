import { useEffect } from 'react';

// "/" is the public website, which the server (and the dev server) answers
// before this app is ever loaded. A client-side link or redirect to "/" lands
// here instead, so it does a real page load to get the website. The session
// flag stops a loop if the website isn't being served (for example the site
// folder hasn't been built), and shows a plain message rather than flashing
// forever.
const FLAG = 'nts-website-redirect';

export function WebsiteRedirect() {
  // "Tried" only counts for a few seconds, so a later, unrelated visit redirects normally.
  const tried = (() => { try { return Date.now() - Number(sessionStorage.getItem(FLAG) || 0) < 4000; } catch { return false; } })();

  useEffect(() => {
    if (tried) return;
    try { sessionStorage.setItem(FLAG, String(Date.now())); } catch { /* storage unavailable: redirect once anyway */ }
    window.location.replace('/');
  }, [tried]);

  if (!tried) return null;
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-center dark:bg-slate-950">
      <div className="max-w-sm">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">NTS Real Estate System</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">The public website isn&apos;t available right now. If you work for a real estate company on the platform, use the sign-in link your company gave you.</p>
        <button
          type="button"
          onClick={() => { try { sessionStorage.removeItem(FLAG); } catch { /* ignore */ } window.location.replace('/'); }}
          className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
