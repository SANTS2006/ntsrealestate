import clsx from 'clsx';

const TONES = {
  neutral: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  brand: 'bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-400',
  success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
  warning: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400',
  danger: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400',
};

export function Badge({ tone = 'neutral', className, children }) {
  return (
    <span className={clsx('inline-flex max-w-full items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium', TONES[tone], className)}>
      {children}
    </span>
  );
}
