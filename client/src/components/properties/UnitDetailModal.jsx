import { Home, Bed, Bath, Ruler, Sofa, Tag, Layers, Wallet } from 'lucide-react';
import { Modal } from '../ui/Modal.jsx';
import { Badge } from '../ui/Badge.jsx';
import { HeroPhoto, InfoGrid, ChipList } from '../ui/Detail.jsx';
import { MediaGallery } from '../media/MediaGallery.jsx';
import { formatCurrency } from '../../utils/currency.js';

const STATUS_TONE = { available: 'success', occupied: 'brand', reserved: 'warning', under_maintenance: 'warning', unavailable: 'neutral' };

// Everything about one unit, with its photo above the name.
export function UnitDetailModal({ unit, onClose }) {
  if (!unit) return null;
  const offers = [
    unit.offerRent && { label: 'Rent', value: `${formatCurrency(unit.monthlyRent)} / month` },
    unit.offerSale && unit.salePrice != null && { label: 'Buy', value: formatCurrency(unit.salePrice) },
    unit.offerLease && unit.leasePrice != null && { label: 'Lease', value: `${formatCurrency(unit.leasePrice)} / year${unit.leaseTermMonths ? ` · ${unit.leaseTermMonths} months` : ''}` },
  ].filter(Boolean);

  return (
    <Modal open={Boolean(unit)} onClose={onClose} title={unit.isWhole ? 'Property details' : 'Unit details'} size="lg">
      <div className="flex min-w-0 flex-col gap-5">
        <HeroPhoto
          imageUrl={unit.coverImageUrl}
          icon={Home}
          title={unit.isWhole ? 'Whole property' : `Unit ${unit.unitNumber}`}
          subtitle={unit.unitType}
          badges={<><Badge tone={STATUS_TONE[unit.status] ?? 'neutral'}>{unit.status === 'occupied' ? 'rented' : unit.status.replace('_', ' ')}</Badge>{unit.isShared && <Badge tone="neutral">Shared</Badge>}</>}
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {offers.map((o) => (
            <div key={o.label} className="min-w-0 rounded-xl border border-brand-200 bg-brand-50/60 px-4 py-3 dark:border-brand-900 dark:bg-brand-950/30">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">{o.label}</p>
              <p className="mt-0.5 break-words text-sm font-bold text-slate-900 dark:text-slate-100">{o.value}</p>
            </div>
          ))}
        </div>

        <InfoGrid cols={4} items={[
          { icon: Bed, label: 'Bedrooms', value: unit.bedrooms },
          { icon: Bath, label: 'Bathrooms', value: unit.bathrooms },
          { icon: Ruler, label: 'Area', value: unit.area != null ? `${unit.area} sq ft` : null },
          { icon: Layers, label: 'Floor', value: unit.floor },
          { icon: Sofa, label: 'Furnished', value: unit.furnished ? 'Yes' : 'No' },
          { icon: Tag, label: 'Type', value: unit.unitType },
          { icon: Wallet, label: 'Deposit', value: unit.securityDeposit != null ? formatCurrency(unit.securityDeposit) : null },
        ]} />

        {unit.description && <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-600 dark:text-slate-300">{unit.description}</p>}

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Facilities</p>
          <ChipList items={unit.amenities} empty="No facilities listed." />
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">Photos &amp; videos</p>
          <MediaGallery entityType="unit" entityId={unit.id} />
        </div>
      </div>
    </Modal>
  );
}
