import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Building2 } from 'lucide-react';
import clsx from 'clsx';
import { ThemeToggle } from '../ui/ThemeToggle.jsx';
import { applyColorRamp } from '../../utils/colorRamp.js';

const ACTION = 'inline-flex min-h-[2.75rem] max-w-full items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-center text-sm font-semibold leading-tight transition';
export const PRIMARY_ACTION = clsx(ACTION, 'bg-brand-700 bg-gradient-to-r from-brand-600 to-accent-600 text-white shadow-lg shadow-brand-600/25 hover:from-brand-700 hover:to-accent-700');
export const SECONDARY_ACTION = clsx(ACTION, 'border border-slate-300 bg-white/70 text-slate-700 hover:bg-white dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:bg-slate-800');

function Mark({ src, name }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return (
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-accent-600 text-white">
        <Building2 size={28} aria-hidden="true" />
      </span>
    );
  }
  return <img src={src} alt={name} width={56} height={56} className="h-14 w-14 shrink-0 rounded-2xl object-contain shadow-md" onError={() => setBroken(true)} />;
}

// The "page not found" screen, shared by the main system and every company.
// `colors` ({ primary, secondary }) paints this screen only: the values are set
// on its own element, so a company's colours never leak into the rest of the app.
export function NotFoundScreen({ brandName, logoUrl, colors, title, message, path, children }) {
  const ref = useRef(null);

  useEffect(() => {
    if (colors?.primary) applyColorRamp('brand', colors.primary, ref.current);
    if (colors?.secondary) applyColorRamp('accent', colors.secondary, ref.current);
  }, [colors?.primary, colors?.secondary]);

  useEffect(() => {
    const previous = document.title;
    document.title = `Page not found — ${brandName}`;
    return () => { document.title = previous; };
  }, [brandName]);

  const canGoBack = window.history.length > 1;

  return (
    <div
      ref={ref}
      className="custom-scrollbar relative flex h-[calc(100vh-var(--maintenance-offset,0px))] h-[calc(100dvh-var(--maintenance-offset,0px))] flex-col overflow-y-auto overflow-x-hidden bg-gradient-to-br from-slate-50 via-brand-50/40 to-accent-50/30 dark:from-slate-950 dark:via-brand-950/40 dark:to-slate-900"
    >
      <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-accent-400/20 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-brand-500/20 blur-3xl" aria-hidden="true" />

      <header className="relative flex items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Mark src={logoUrl} name={brandName} />
          <p className="min-w-0 truncate text-base font-semibold text-slate-900 dark:text-slate-100">{brandName}</p>
        </div>
        <ThemeToggle />
      </header>

      <main className="relative flex flex-1 flex-col items-center justify-center px-4 py-8 text-center">
        <p
          aria-hidden="true"
          className="select-none bg-gradient-to-br from-brand-600 to-accent-500 bg-clip-text px-2 dark:from-brand-300 dark:to-accent-300 text-[clamp(6rem,28vw,13rem)] font-extrabold leading-none tracking-tighter text-transparent"
        >
          404
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">
          <span className="sr-only">Error 404: </span>{title}
        </h1>
        <p className="mt-3 max-w-md text-sm text-slate-600 dark:text-slate-400 sm:text-base">{message}</p>
        {path && (
          <code className="mt-4 max-w-full break-all rounded-lg border border-slate-200 bg-white/70 px-3 py-1.5 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
            {path}
          </code>
        )}
        <div className="mt-8 flex w-full max-w-md flex-col items-stretch justify-center gap-3 sm:max-w-none sm:flex-row sm:items-center">
          {children}
          {canGoBack && (
            <button type="button" onClick={() => window.history.back()} className={SECONDARY_ACTION}>
              <ArrowLeft size={16} aria-hidden="true" /> Go back
            </button>
          )}
        </div>
      </main>

      <footer className="relative px-4 py-4 text-center text-xs text-slate-500 dark:text-slate-500">
        &copy; {new Date().getFullYear()} {brandName}. All rights reserved.
      </footer>
    </div>
  );
}
