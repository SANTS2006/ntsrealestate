import { Modal } from '../ui/Modal.jsx';
import { Layers } from 'lucide-react';
import { HeroPhoto } from '../ui/Detail.jsx';
import { UnitsPanel } from './UnitsPanel.jsx';

// Opened from a BuildingCard: that building's units as an image-card grid.
export function BuildingUnitsModal({ open, onClose, building, onUnitsChanged }) {
  if (!building) return null;
  return (
    <Modal open={open} onClose={onClose} title="Building details" size="xl">
      <div className="mb-5">
        <HeroPhoto
          imageUrl={building.coverImageUrl}
          icon={Layers}
          title={building.name}
          subtitle={[building.code, building.floors != null ? `${building.floors} floors` : null].filter(Boolean).join(' · ') || undefined}
        />
      </div>
      <p className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Units in this building</p>
      <UnitsPanel buildingId={building.id} onChanged={onUnitsChanged} emptyText="No units in this building yet." columns="sm:grid-cols-2 lg:grid-cols-3" />
    </Modal>
  );
}
