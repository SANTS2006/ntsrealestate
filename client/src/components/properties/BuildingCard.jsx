import { useState } from 'react';
import { hasPermission } from '../../config/capabilities.js';
import { Layers, Home, Pencil, Trash2, Images, Bed, Bath, Wallet } from 'lucide-react';
import { Button } from '../ui/Button.jsx';
import { Badge } from '../ui/Badge.jsx';
import { ConfirmDialog } from '../ui/ConfirmDialog.jsx';
import { formatCurrency } from '../../utils/currency.js';

const STATUS_TONE = { available: 'success', occupied: 'brand', reserved: 'warning', under_maintenance: 'warning', unavailable: 'neutral' };

function Chip({ icon: Icon, children }) {
  return (
    <div className="flex min-w-0 items-center gap-1.5 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
      <Icon size={13} className="shrink-0 text-brand-500" aria-hidden="true" />
      <span className="truncate">{children}</span>
    </div>
  );
}

// Card for a single building — cover image, name/code/floors and either a
// unit-occupancy row (a building with units) or its own price, bedrooms and
// bathrooms (a building that is rented as a whole, `rentable`).
export function BuildingCard({ building, rentable = false, onOpenUnits, onEdit, onDeleted, onOpenMedia, onEndRental }) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const unitSummary = building.unitSummary ?? { total: 0, occupied: 0, available: 0 };
  const rental = building.rental;
  const rented = !building.isShared && (rentable ? rental?.status === 'occupied' : unitSummary.total > 0 && unitSummary.occupied === unitSummary.total);

  return (
    <div className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <button type="button" onClick={rentable ? onEdit : onOpenUnits} className="relative block aspect-[16/9] w-full shrink-0 overflow-hidden bg-gradient-to-br from-brand-100 to-accent-100 text-left dark:from-brand-950 dark:to-accent-950">
        {building.coverImageUrl ? (
          <img src={building.coverImageUrl} alt={building.name} className="h-full w-full object-cover transition-transform duration-300 hover:scale-105" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Layers size={30} className="text-brand-300 dark:text-brand-700" aria-hidden="true" />
          </div>
        )}
        {rentable && rental && <Badge tone={STATUS_TONE[rental.status] ?? 'neutral'} className="absolute right-2.5 top-2.5 shadow-sm">{rental.status === 'occupied' ? 'rented' : rental.status.replace('_', ' ')}</Badge>}
        {!rentable && rented && <Badge tone="warning" className="absolute right-2.5 top-2.5 shadow-sm">Rented</Badge>}
        {building.isShared && <Badge tone="neutral" className="absolute left-2.5 top-2.5 shadow-sm">Shared</Badge>}
      </button>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-900 dark:text-slate-100">{building.name}</p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              {building.code ? `${building.code} · ` : ''}{building.floors != null ? `${building.floors} floors` : 'Floors not set'}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onOpenMedia} aria-label={`Photos for building ${building.name}`}>
            <Images size={14} aria-hidden="true" />
          </Button>
        </div>

        {rentable ? (
          rental ? (
            <div className="grid grid-cols-2 gap-2">
              <Chip icon={Wallet}>{formatCurrency(rental.monthlyRent)}/mo</Chip>
              <Chip icon={Bed}>{rental.bedrooms != null ? `${rental.bedrooms} bedrooms` : '—'}</Chip>
              <Chip icon={Bath}>{rental.bathrooms != null ? `${rental.bathrooms} bathrooms` : '—'}</Chip>
              <Chip icon={Home}>{rental.furnished ? 'Furnished' : 'Unfurnished'}</Chip>
            </div>
          ) : (
            <p className="text-xs text-slate-400">No price set yet.</p>
          )
        ) : (
          <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-center dark:border-slate-800">
            <div>
              <p className="flex items-center justify-center gap-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                <Home size={13} className="text-brand-500" aria-hidden="true" />
                {unitSummary.total}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Units</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-brand-600 dark:text-brand-400">{unitSummary.occupied}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Occupied</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{unitSummary.available}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Available</p>
            </div>
          </div>
        )}

        <div className="mt-auto flex items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          {!rentable && <Button size="sm" onClick={onOpenUnits} className="flex-1">Manage units</Button>}
          {rentable && hasPermission('buildings:update') && <Button size="sm" onClick={onEdit} className="flex-1">Edit details</Button>}
          {rentable && !hasPermission('buildings:update') && <span className="flex-1" />}
          {rentable && rental?.status === 'occupied' && onEndRental && hasPermission('units:update') && <Button variant="secondary" size="sm" onClick={() => setEndOpen(true)}>End rental</Button>}
          {!rentable && hasPermission('buildings:update') && (
            <Button variant="ghost" size="sm" onClick={onEdit} aria-label={`Edit building ${building.name}`}>
              <Pencil size={14} aria-hidden="true" />
            </Button>
          )}
          {hasPermission('buildings:delete') && (
            <Button variant="ghost" size="sm" onClick={() => setDeleteOpen(true)} aria-label={`Delete building ${building.name}`}>
              <Trash2 size={14} className="text-rose-500" aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={endOpen}
        onClose={() => setEndOpen(false)}
        onConfirm={async () => { await onEndRental(rental.unitId); }}
        title="End this rental?"
        description="The renter's hold ends and this building becomes available again, back on the website."
        confirmLabel="End rental"
      />
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={async () => { await onDeleted(building.id); }}
        title="Delete building?"
        description={`This will permanently delete "${building.name}"${rentable ? '' : ' and all its units'}. This cannot be undone.`}
        confirmLabel="Delete"
      />
    </div>
  );
}
