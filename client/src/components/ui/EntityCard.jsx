import { Eye } from 'lucide-react';
import { Button } from './Button.jsx';

// Generic "profile card" used for tenants, owners, and similar records: a
// cover photo (or initials avatar) with a status badge in the corner, a
// name/subtitle header, a small icon-labeled info grid, and an action
// button. Buildings/units use a variant of this same shape inline where
// they're rendered (BuildingCard/UnitCard) since their info grids differ
// enough to not share this component directly.
export function EntityCard({ imageUrl, initials, badge, title, subtitle, infoItems, onAction, actionLabel = 'View profile' }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden bg-gradient-to-br from-brand-100 to-accent-100 dark:from-brand-950 dark:to-accent-950">
        {imageUrl ? (
          <img src={imageUrl} alt={title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-brand-600 to-accent-600 text-xl font-semibold text-white">
              {initials}
            </span>
          </div>
        )}
        {badge && <span className="absolute right-2.5 top-2.5">{badge}</span>}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <p className="truncate font-semibold text-slate-900 dark:text-slate-100">{title}</p>
          {subtitle && <p className="truncate text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
        </div>

        {infoItems?.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {infoItems.map((item) => (
              <div key={item.label} className="min-w-0 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5 dark:border-slate-800 dark:bg-slate-800/50">
                <p className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                  {item.icon && <item.icon size={11} className="shrink-0" aria-hidden="true" />}
                  <span className="truncate">{item.label}</span>
                </p>
                <p className="mt-0.5 truncate text-sm font-medium text-slate-900 dark:text-slate-100">{item.value}</p>
              </div>
            ))}
          </div>
        )}

        {onAction && (
          <Button type="button" onClick={onAction} className="mt-auto">
            <Eye size={14} aria-hidden="true" />
            {actionLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
