import { forwardRef, useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import clsx from 'clsx';

// A labeled form field wired for react-hook-form's `register()` spread —
// handles the label/input/error-message association (htmlFor + aria-*) so
// every form in the app gets that wiring for free instead of re-deriving it.
//
// `type="password"` automatically gets a show/hide toggle — this is the one
// place password inputs are rendered app-wide, so every password field
// (login, register, reset, change-password, MFA disable) gets it for free.
// `glass` swaps the solid input chrome for a translucent/backdrop-blurred
// look, used on the auth screens where the page itself has a gradient
// background showing through.
export const Field = forwardRef(function Field(
  { label, error, hint, id, className, inputClassName, type = 'text', required, glass = false, ...props },
  ref
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = error ? `${inputId}-error` : undefined;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const isPassword = type === 'password';
  const [visible, setVisible] = useState(false);

  return (
    <div className={clsx('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
          {required && <span className="ml-0.5 text-rose-500" aria-hidden="true">*</span>}
        </label>
      )}
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          type={isPassword ? (visible ? 'text' : 'password') : type}
          required={required}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={clsx(errorId, hintId) || undefined}
          className={clsx(
            'h-10 w-full rounded-lg border px-3 text-sm text-slate-900 placeholder:text-slate-400',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950',
            glass
              ? 'border-slate-300/80 bg-white/50 backdrop-blur-md placeholder:text-slate-400 dark:border-slate-700/50 dark:bg-slate-900/40 dark:text-slate-100 dark:placeholder:text-slate-500'
              : 'bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500',
            error ? 'border-rose-400 dark:border-rose-600' : !glass && 'border-slate-300 dark:border-slate-700',
            isPassword && 'pr-10',
            inputClassName
          )}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? 'Hide password' : 'Show password'}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
          >
            {visible ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
          </button>
        )}
      </div>
      {hint && !error && (
        <p id={hintId} className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs text-rose-600 dark:text-rose-400">{error}</p>
      )}
    </div>
  );
});

export const SelectField = forwardRef(function SelectField(
  { label, error, hint, id, className, selectClassName, required, children, ...props },
  ref
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = error ? `${inputId}-error` : undefined;
  const hintId = hint ? `${inputId}-hint` : undefined;

  return (
    <div className={clsx('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
          {required && <span className="ml-0.5 text-rose-500" aria-hidden="true">*</span>}
        </label>
      )}
      <select
        ref={ref}
        id={inputId}
        required={required}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={clsx(errorId, hintId) || undefined}
        className={clsx(
          'h-10 rounded-lg border bg-white px-3 text-sm text-slate-900',
          'dark:bg-slate-900 dark:text-slate-100',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950',
          error ? 'border-rose-400 dark:border-rose-600' : 'border-slate-300 dark:border-slate-700',
          selectClassName
        )}
        {...props}
      >
        {children}
      </select>
      {hint && !error && (
        <p id={hintId} className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs text-rose-600 dark:text-rose-400">{error}</p>
      )}
    </div>
  );
});

export const TextareaField = forwardRef(function TextareaField(
  { label, error, hint, id, className, textareaClassName, required, rows = 3, ...props },
  ref
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = error ? `${inputId}-error` : undefined;
  const hintId = hint ? `${inputId}-hint` : undefined;

  return (
    <div className={clsx('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
          {required && <span className="ml-0.5 text-rose-500" aria-hidden="true">*</span>}
        </label>
      )}
      <textarea
        ref={ref}
        id={inputId}
        rows={rows}
        required={required}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={clsx(errorId, hintId) || undefined}
        className={clsx(
          'rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400',
          'dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950',
          error ? 'border-rose-400 dark:border-rose-600' : 'border-slate-300 dark:border-slate-700',
          textareaClassName
        )}
        {...props}
      />
      {hint && !error && (
        <p id={hintId} className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs text-rose-600 dark:text-rose-400">{error}</p>
      )}
    </div>
  );
});
