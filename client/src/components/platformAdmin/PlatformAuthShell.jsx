import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';
import { ThemeToggle } from '../ui/ThemeToggle.jsx';
import { useBranding } from '../../contexts/BrandingContext.jsx';

// The centered card every platform admin sign-in screen (login, forgot
// password, reset password) shares. Pins the platform identity while mounted
// so no tenant's branding can show through.
export function PlatformAuthShell({ title, subtitle = 'NTS Real Estate System', children, footer }) {
  const { enterPlatformMode, leavePlatformMode } = useBranding();
  useEffect(() => {
    enterPlatformMode();
    return leavePlatformMode;
  }, [enterPlatformMode, leavePlatformMode]);

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-slate-50 via-brand-50/40 to-accent-50/30 dark:from-slate-950 dark:via-brand-950/40 dark:to-slate-900">
      <header className="flex items-center justify-between px-6 py-5">
        <Link to="/" className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
          <Home size={17} aria-hidden="true" />
          Home
        </Link>
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-center justify-center px-4 pb-10">
        <div className="w-full max-w-sm">
          <div className="rounded-2xl border border-white/60 bg-white/70 p-8 shadow-xl backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-900/60">
            <div className="mb-6 flex flex-col items-center gap-3 text-center">
              <img src="/logo-nts.png" alt="NTS Digital Solutions" className="h-16 w-16 rounded-2xl shadow-md" />
              <div>
                <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{title}</h1>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
              </div>
            </div>
            {children}
          </div>
          {footer && <p className="mt-5 text-center text-sm text-slate-600 dark:text-slate-400">{footer}</p>}
        </div>
      </main>
    </div>
  );
}
