export function PageHeader({ icon: Icon, eyebrow, title, description, action }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 px-4 py-5 sm:px-6 sm:py-6 dark:border-slate-800 dark:from-slate-900 dark:to-slate-950">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 items-start gap-4">
          {Icon && (
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-accent-600 text-white">
              <Icon size={22} aria-hidden="true" />
            </span>
          )}
          <div className="min-w-0">
            {eyebrow && (
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-500" aria-hidden="true" />
                {eyebrow}
              </p>
            )}
            <h1 className="mt-0.5 break-words text-2xl font-bold text-slate-900 dark:text-slate-100">{title}</h1>
            {description && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>}
          </div>
        </div>
        {action && <div className="w-full shrink-0 sm:w-auto [&>*]:max-sm:w-full">{action}</div>}
      </div>
    </div>
  );
}
