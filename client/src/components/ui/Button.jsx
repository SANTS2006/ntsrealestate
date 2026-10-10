import { forwardRef, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';

const VARIANTS = {
  // Blue → teal, echoing the logo's gradient — a solid brand-700 fallback
  // color sits behind it so disabled/no-gradient-support states still read
  // as a normal button.
  primary: 'bg-brand-700 bg-gradient-to-r from-brand-600 to-accent-600 text-white hover:from-brand-700 hover:to-accent-700 focus-visible:ring-brand-500 disabled:from-brand-300 disabled:to-brand-300',
  secondary: 'bg-gradient-to-r from-white to-slate-100 text-slate-700 border border-slate-300 hover:from-slate-50 hover:to-slate-200 dark:from-slate-800 dark:to-slate-900 dark:text-slate-200 dark:border-slate-700 dark:hover:from-slate-700 dark:hover:to-slate-800',
  danger: 'bg-rose-700 bg-gradient-to-r from-rose-600 to-red-600 text-white hover:from-rose-700 hover:to-red-700 focus-visible:ring-rose-500 disabled:from-rose-300 disabled:to-rose-300',
  ghost: 'text-slate-600 hover:bg-gradient-to-r hover:from-slate-100 hover:to-slate-200 dark:text-slate-300 dark:hover:from-slate-800 dark:hover:to-slate-700',
};

const SIZES = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-11 px-5 text-base gap-2',
};

// The activity mark: three dots in a wave, with a light line sweeping along
// the bottom edge. Uses the button's own text colour, so it fits every
// variant and every company's colours.
function ActivityIndicator() {
  return (
    <>
      <span className="absolute inset-0 flex items-center justify-center gap-1" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span key={i} className="btn-dot h-1.5 w-1.5 rounded-full bg-current" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </span>
      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 overflow-hidden rounded-b-lg" aria-hidden="true">
        <span className="btn-sweep block h-full w-2/5 bg-current opacity-70" />
      </span>
    </>
  );
}

// While `loading`, the label fades to invisible (kept in the layout so the
// button doesn't resize) and a single centered spinner takes over as the
// dominant visual — a clearer "something is happening" signal than a small
// icon sitting next to the text. Callers just need to wire `loading` to
// whatever async state they already have (react-hook-form's `isSubmitting`,
// a local `useState`, etc.) — see call sites throughout the app.
export const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', loading = false, disabled, className, children, type = 'button', onClick, ...props },
  ref
) {
  // Any click handler that returns a promise (an async action) keeps the
  // button busy until it settles, so every task shows activity without each
  // call site wiring its own `loading` state.
  const [pending, setPending] = useState(false);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const handleClick = onClick && ((e) => {
    const result = onClick(e);
    if (result && typeof result.then === 'function') {
      setPending(true);
      result.then(() => {}, () => {}).finally(() => { if (mounted.current) setPending(false); });
    }
    return result;
  });
  const busy = loading || pending;

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      onClick={handleClick}
      className={clsx(
        'relative inline-flex items-center justify-center rounded-lg font-medium transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-70',
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...props}
    >
      {busy && <ActivityIndicator />}
      <span className={clsx('inline-flex items-center', SIZES[size].match(/gap-\S+/)?.[0], busy && 'invisible')}>
        {children}
      </span>
    </button>
  );
});
