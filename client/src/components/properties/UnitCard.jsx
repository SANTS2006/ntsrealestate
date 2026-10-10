import { useState } from 'react';
import { hasPermission } from '../../config/capabilities.js';
import { Bed, Bath, Ruler, Wallet, Pencil, Trash2, Images, Home } from 'lucide-react';
import { Badge } from '../ui/Badge.jsx';
import { Button } from '../ui/Button.jsx';
import { ConfirmDialog } from '../ui/ConfirmDialog.jsx';
import { formatCurrency } from '../../utils/currency.js';

const UNIT_STATUS_TONE = { available: 'success', occupied: 'brand', reserved: 'warning', under_maintenance: 'warning', unavailable: 'neutral' };
const MANUALLY_SETTABLE = ['available', 'reserved', 'under_maintenance', 'unavailable'];

// Card presentation for a single unit — cover image with status badge,
// bed/bath/area/rent stat grid, and edit/delete/media actions. Mirrors the
// visual language of PropertyCard/EntityCard so buildings, units, tenants,
// and owners all read as one consistent design system.
export function UnitCard({ unit, onOpen, onEdit, onDeleted, onStatusChanged, onEndRental, onOpenMedia }) {
  const canUpdate = hasPermission('units:update');
  const canDelete = hasPermission('units:delete');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [statusError, setStatusError] = useState(null);

  return (
    <div className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div role={onOpen ? 'button' : undefined} tabIndex={onOpen ? 0 : undefined} onClick={onOpen} onKeyDown={onOpen ? (e) => { if (e.key === 'Enter') onOpen(); } : undefined} aria-label={onOpen ? `View details of ${unit.isWhole ? 'the whole property' : `unit ${unit.unitNumber}`}` : undefined} className={`relative aspect-[16/10] w-full shrink-0 overflow-hidden bg-gradient-to-br from-brand-100 to-accent-100 dark:from-brand-950 dark:to-accent-950 ${onOpen ? 'cursor-pointer' : ''}`}>
        {unit.coverImageUrl ? (
          <img src={unit.coverImageUrl} alt={`Unit ${unit.unitNumber}`} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Home size={28} className="text-brand-300 dark:text-brand-700" aria-hidden="true" />
          </div>
        )}
        <Badge tone={UNIT_STATUS_TONE[unit.status] ?? 'neutral'} className="absolute right-2.5 top-2.5 shadow-sm">
          {unit.status === 'occupied' ? 'rented' : unit.status.replace('_', ' ')}
        </Badge>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-900 dark:text-slate-100">{unit.isWhole ? 'Whole property' : `Unit ${unit.unitNumber}`}</p>
            {unit.unitType && <p className="truncate text-xs text-slate-500 dark:text-slate-400">{unit.unitType}</p>}
          </div>
          <Button variant="ghost" size="sm" onClick={onOpenMedia} aria-label={`Photos for unit ${unit.unitNumber}`}>
            <Images size={14} aria-hidden="true" />
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="flex min-w-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
            <Bed size={13} className="text-brand-500" aria-hidden="true" />
            {unit.bedrooms != null ? `${unit.bedrooms} bd` : '—'}
          </div>
          <div className="flex min-w-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
            <Bath size={13} className="text-brand-500" aria-hidden="true" />
            {unit.bathrooms != null ? `${unit.bathrooms} ba` : '—'}
          </div>
          <div className="flex min-w-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
            <Ruler size={13} className="text-brand-500" aria-hidden="true" />
            {unit.area != null ? `${unit.area} sqft` : '—'}
          </div>
          <div className="col-span-2 flex min-w-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
            <Wallet size={13} className="text-brand-500" aria-hidden="true" />
            {formatCurrency(unit.monthlyRent)}/mo
          </div>
        </div>

        {unit.amenities?.length > 0 && (
          <p className="truncate text-xs text-slate-500 dark:text-slate-400" title={unit.amenities.join(', ')}>
            {unit.amenities.slice(0, 3).join(' · ')}{unit.amenities.length > 3 ? ` +${unit.amenities.length - 3}` : ''}
          </p>
        )}

        {statusError && <p className="text-xs text-rose-600 dark:text-rose-400">{statusError}</p>}

        {(canUpdate || canDelete) && (
          <div className="mt-auto flex items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
            {!canUpdate ? <span className="flex-1" /> : unit.status !== 'occupied' ? (
              <select
                value={unit.status}
                onChange={async (e) => {
                  setStatusError(null);
                  try {
                    await onStatusChanged(unit.id, e.target.value);
                  } catch (err) {
                    setStatusError(err.message);
                  }
                }}
                className="h-8 flex-1 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                {MANUALLY_SETTABLE.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
            ) : (
              onEndRental ? <Button variant="secondary" size="sm" className="flex-1" onClick={() => setEndOpen(true)}>End rental</Button> : <span className="flex-1 text-xs text-slate-400">Rented</span>
            )}
            {canUpdate && (
              <Button variant="ghost" size="sm" onClick={onEdit} aria-label={`Edit unit ${unit.unitNumber}`}>
                <Pencil size={14} aria-hidden="true" />
              </Button>
            )}
            {canDelete && !unit.isWhole && (
              <Button variant="ghost" size="sm" onClick={() => setDeleteOpen(true)} aria-label={`Delete unit ${unit.unitNumber}`}>
                <Trash2 size={14} className="text-rose-500" aria-hidden="true" />
              </Button>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={endOpen}
        onClose={() => setEndOpen(false)}
        onConfirm={async () => { await onEndRental(unit.id); }}
        title="End this rental?"
        description="The renter's hold ends and this becomes available again, back on the website. Terminate any running lease first."
        confirmLabel="End rental"
      />
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={async () => { await onDeleted(unit.id); }}
        title="Delete unit?"
        description={`This will permanently delete unit ${unit.unitNumber}. This cannot be undone.`}
        confirmLabel="Delete"
      />
    </div>
  );
}
