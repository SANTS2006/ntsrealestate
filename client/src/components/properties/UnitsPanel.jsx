import { useCallback, useEffect, useState } from 'react';
import { Plus, DoorOpen } from 'lucide-react';
import { Modal } from '../ui/Modal.jsx';
import { Button } from '../ui/Button.jsx';
import { Spinner } from '../ui/Spinner.jsx';
import { Alert } from '../ui/Alert.jsx';
import { EmptyPanel } from '../ui/Detail.jsx';
import { UnitCard } from './UnitCard.jsx';
import { UnitFormModal } from './UnitFormModal.jsx';
import { UnitDetailModal } from './UnitDetailModal.jsx';
import { MediaGallery } from '../media/MediaGallery.jsx';
import { unitsApi } from '../../api/units.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { CAN_MANAGE_UNITS, CAN_UPLOAD_DOCUMENTS, CAN_DELETE_DOCUMENTS, canAny } from '../../config/capabilities.js';

// The units of one building (or of a property that has units only) as a
// card grid with add / edit / delete / status / photos. Used inline on the
// property page and inside the building's units dialog.
export function UnitsPanel({ buildingId, onChanged, emptyText = 'No units yet.', columns = 'sm:grid-cols-2' }) {
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  const canManage = canAny(roles, CAN_MANAGE_UNITS);
  const canUploadMedia = canAny(roles, CAN_UPLOAD_DOCUMENTS);
  const canDeleteMedia = canAny(roles, CAN_DELETE_DOCUMENTS);

  const [units, setUnits] = useState(null);
  const [error, setError] = useState(null);
  const [formState, setFormState] = useState(null); // null | 'new' | unit object
  const [mediaUnit, setMediaUnit] = useState(null);
  const [viewUnit, setViewUnit] = useState(null);

  const loadUnits = useCallback(() => {
    unitsApi.list(buildingId).then((res) => setUnits(res.data)).catch((err) => setError(err.message));
  }, [buildingId]);

  useEffect(() => { setUnits(null); loadUnits(); }, [loadUnits]);

  const changed = () => { loadUnits(); onChanged?.(); };

  const handleDelete = async (unitId) => {
    await unitsApi.remove(unitId);
    setUnits((prev) => prev.filter((u) => u.id !== unitId));
    onChanged?.();
  };

  const handleEndRental = async (unitId) => {
    const updated = await unitsApi.endRental(unitId);
    setUnits((prev) => prev.map((u) => (u.id === unitId ? updated.data : u)));
    onChanged?.();
  };

  const handleStatusChange = async (unitId, status) => {
    const updated = await unitsApi.setStatus(unitId, status);
    setUnits((prev) => prev.map((u) => (u.id === unitId ? updated.data : u)));
    onChanged?.();
  };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {error && <Alert variant="error">{error}</Alert>}
      {canManage && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setFormState('new')}>
            <Plus size={14} aria-hidden="true" />
            Add unit
          </Button>
        </div>
      )}

      {units === null ? (
        <div className="py-10"><Spinner label="Loading units…" /></div>
      ) : units.length === 0 ? (
        <EmptyPanel icon={DoorOpen}>{emptyText}</EmptyPanel>
      ) : (
        <div className={`grid grid-cols-1 gap-4 ${columns}`}>
          {units.map((u) => (
            <UnitCard
              key={u.id}
              unit={u}
              onOpen={() => setViewUnit(u)}
              onEdit={() => setFormState(u)}
              onDeleted={handleDelete}
              onStatusChanged={handleStatusChange}
              onEndRental={handleEndRental}
              onOpenMedia={() => setMediaUnit(u)}
            />
          ))}
        </div>
      )}

      <UnitDetailModal unit={viewUnit} onClose={() => setViewUnit(null)} />
      <UnitFormModal
        open={Boolean(formState)}
        onClose={() => setFormState(null)}
        onSaved={changed}
        buildingId={buildingId}
        unit={formState === 'new' ? null : formState}
      />
      <Modal open={Boolean(mediaUnit)} onClose={() => setMediaUnit(null)} title={mediaUnit ? `Unit ${mediaUnit.unitNumber} — Photos & videos` : ''} size="lg">
        {mediaUnit && (
          <MediaGallery entityType="unit" entityId={mediaUnit.id} canUpload={canUploadMedia} canDelete={canDeleteMedia} onChange={changed} />
        )}
      </Modal>
    </div>
  );
}
