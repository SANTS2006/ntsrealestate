import { createPortal } from 'react-dom';
import { useSyncExternalStore } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { LogoSpinner } from './Spinner.jsx';

// The sign-out notice lives outside the page tree on purpose: the moment the
// session ends the app redirects to the sign-in page, and the notice must
// survive that so people see "signing out…" and then "signed out".
let phase = null; // null | 'working' | 'done'
const listeners = new Set();
const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

export function setSignOutPhase(next) {
  phase = next;
  listeners.forEach((fn) => fn());
}

// Runs a sign-out with the full-screen notice around it.
export async function signOutWithNotice(task) {
  setSignOutPhase('working');
  try {
    await task();
    setSignOutPhase('done');
    await new Promise((resolve) => setTimeout(resolve, 900));
  } finally {
    setSignOutPhase(null);
  }
}

// Mounted once at the root of the app.
export function SignOutHost() {
  const current = useSyncExternalStore(subscribe, () => phase);
  if (!current) return null;
  return createPortal(
    <div role="alertdialog" aria-live="assertive" aria-label="Signing out" className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="flex w-full max-w-xs flex-col items-center gap-4 rounded-2xl border border-slate-200 bg-white px-6 py-8 text-center shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        {current === 'done' ? (
          <>
            <CheckCircle2 size={56} className="text-emerald-500" aria-hidden="true" />
            <div>
              <p className="text-base font-semibold text-slate-900 dark:text-slate-100">You are signed out</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">See you again soon.</p>
            </div>
          </>
        ) : (
          <>
            <LogoSpinner size={72} />
            <div>
              <p className="text-base font-semibold text-slate-900 dark:text-slate-100">Signing you out…</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Securing your session.</p>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
