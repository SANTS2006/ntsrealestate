import clsx from 'clsx';
import { Card, CardBody } from './Card.jsx';

const TONES = {
  brand: { dot: 'bg-brand-500', icon: 'bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400' },
  success: { dot: 'bg-emerald-500', icon: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400' },
  warning: { dot: 'bg-amber-500', icon: 'bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400' },
  danger: { dot: 'bg-rose-500', icon: 'bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400' },
  neutral: { dot: 'bg-slate-400', icon: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' },
};

// Small KPI tile used at the top of list pages — a colored status dot next
// to the label, an icon badge, a large value, and an optional subtext line.
export function StatCard({ icon: Icon, label, value, subtext, tone = 'brand' }) {
  const t = TONES[tone] ?? TONES.brand;
  return (
    <Card>
      <CardBody>
        <div className="flex items-center justify-between gap-2">
          <p className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
            <span className={clsx('h-1.5 w-1.5 shrink-0 rounded-full', t.dot)} aria-hidden="true" />
            <span className="truncate">{label}</span>
          </p>
          {Icon && (
            <span className={clsx('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', t.icon)}>
              <Icon size={15} aria-hidden="true" />
            </span>
          )}
        </div>
        <p className="mt-2 truncate text-2xl font-bold capitalize text-slate-900 dark:text-slate-100" title={typeof value === 'string' ? value : undefined}>{value}</p>
        {subtext && <p className="mt-0.5 text-xs text-slate-400">{subtext}</p>}
      </CardBody>
    </Card>
  );
}
