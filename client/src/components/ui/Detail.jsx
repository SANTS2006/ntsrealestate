import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import clsx from 'clsx';

// Building blocks shared by every detail page, so they all read the same way:
// a header card (title, badges, actions), tidy label/value tiles, titled
// sections and chips. Everything is `min-w-0` + wrapped/truncated so long
// names, emails and addresses never push the page sideways.

export function BackLink({ to, children }) {
  return (
    <Link to={to} className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100">
      <ArrowLeft size={15} aria-hidden="true" />
      {children}
    </Link>
  );
}

export function DetailHeader({ icon: Icon, title, badges, subtitle, meta, actions, imageUrl, avatarUrl }) {
  return (
    <header className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      {/* The photo sits above the name; without one it is a colour band. */}
      <div className={clsx('relative bg-gradient-to-r from-brand-600 via-brand-500 to-accent-500', imageUrl ? 'h-44 sm:h-60' : 'h-20 sm:h-24')}>
        {imageUrl && <img src={imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
      </div>
      <div className="relative z-10 flex flex-col gap-4 px-5 pb-5 pt-4 sm:flex-row sm:items-end sm:justify-between sm:px-6">
        <div className="flex min-w-0 items-end gap-4">
          {(Icon || avatarUrl) && (
            <span className="-mt-12 flex h-16 w-16 shrink-0 items-center justify-center self-start overflow-hidden rounded-2xl border-4 border-white bg-gradient-to-br from-brand-600 to-accent-600 text-white shadow-md dark:border-slate-900 sm:-mt-14 sm:h-20 sm:w-20">
              {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : <Icon size={28} aria-hidden="true" />}
            </span>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <h1 className="min-w-0 break-words text-xl font-bold text-slate-900 dark:text-slate-100 sm:text-2xl">{title}</h1>
              {badges}
            </div>
            {subtitle && <p className="mt-1 flex min-w-0 items-start gap-1.5 break-words text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
            {meta && <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">{meta}</div>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">{actions}</div>}
      </div>
    </header>
  );
}

export function Section({ title, description, action, children, className, bodyClassName }) {
  return (
    <section className={clsx('min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900', className)}>
      {(title || action) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5 dark:border-slate-800">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
            {description && <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={clsx('p-5', bodyClassName)}>{children}</div>
    </section>
  );
}

// A grid of label/value tiles. `cols` is the column count at the widest size.
export function InfoGrid({ items, cols = 3 }) {
  const grid = { 1: '', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-2 lg:grid-cols-3', 4: 'sm:grid-cols-2 lg:grid-cols-4' }[cols] ?? 'sm:grid-cols-2';
  return (
    <dl className={clsx('grid grid-cols-1 gap-3', grid)}>
      {items.filter(Boolean).map((item) => <InfoItem key={item.label} {...item} />)}
    </dl>
  );
}

export function InfoItem({ icon: Icon, label, value, mono = false, wide = false }) {
  const empty = value === null || value === undefined || value === '';
  return (
    <div className={clsx('min-w-0 rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-2.5 dark:border-slate-800 dark:bg-slate-800/40', wide && 'sm:col-span-full')}>
      <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase leading-tight tracking-wide text-slate-400">
        {Icon && <Icon size={12} className="shrink-0" aria-hidden="true" />}
        <span className="min-w-0 break-words">{label}</span>
      </dt>
      <dd className={clsx('mt-0.5 min-w-0 break-words text-sm font-medium text-slate-900 dark:text-slate-100', mono && 'font-mono')}>
        {empty ? <span className="font-normal text-slate-400">—</span> : value}
      </dd>
    </div>
  );
}

export function ChipList({ items, empty }) {
  if (!items?.length) return empty ? <p className="text-sm text-slate-400">{empty}</p> : null;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((name) => (
        <li key={name} className="max-w-full truncate rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 dark:border-brand-900 dark:bg-brand-950/50 dark:text-brand-300">{name}</li>
      ))}
    </ul>
  );
}

export function EmptyPanel({ icon: Icon, children }) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center">
      {Icon && <Icon size={28} className="text-slate-300 dark:text-slate-700" aria-hidden="true" />}
      <p className="text-sm text-slate-500 dark:text-slate-400">{children}</p>
    </div>
  );
}

// A compact photo header for dialogs (a building, a unit): the picture sits
// above the name, with a small picture of the same place as its icon.
export function HeroPhoto({ imageUrl, icon: Icon, title, subtitle, badges }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className={clsx('relative bg-gradient-to-r from-brand-600 via-brand-500 to-accent-500', imageUrl ? 'h-40 sm:h-52' : 'h-14')}>
        {imageUrl && <img src={imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
      </div>
      <div className="relative z-10 flex min-w-0 items-end gap-3 px-4 pb-4 pt-3">
        <span className="-mt-10 flex h-14 w-14 shrink-0 items-center justify-center self-start overflow-hidden rounded-xl border-4 border-white bg-gradient-to-br from-brand-600 to-accent-600 text-white shadow-md dark:border-slate-900">
          {imageUrl ? <img src={imageUrl} alt="" className="h-full w-full object-cover" /> : Icon && <Icon size={22} aria-hidden="true" />}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="min-w-0 break-words text-lg font-bold text-slate-900 dark:text-slate-100">{title}</h3>
            {badges}
          </div>
          {subtitle && <p className="mt-0.5 break-words text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}
