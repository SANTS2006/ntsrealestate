import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LandPlot, MapPin, Pencil, Trash2, Ruler, Wallet, Tag, FileCheck2, UserCircle, Compass, MapPinned } from 'lucide-react';
import { Button } from '../../components/ui/Button.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { LoadingState } from '../../components/ui/Spinner.jsx';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.jsx';
import { BackLink, DetailHeader, Section, InfoGrid, ChipList } from '../../components/ui/Detail.jsx';
import { MediaGallery } from '../../components/media/MediaGallery.jsx';
import { LandFormModal } from '../../components/lands/LandFormModal.jsx';
import { landsApi } from '../../api/lands.js';
import { hasPermission } from '../../config/capabilities.js';
import { LAND_STATUS, LAND_TYPES, labelFor } from '../../config/dealLabels.js';
import { formatCurrency } from '../../utils/currency.js';

export default function LandDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [land, setLand] = useState(null);
  const [error, setError] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [statusError, setStatusError] = useState(null);

  const load = useCallback(() => {
    landsApi.get(id).then((res) => setLand(res.data)).catch((err) => setError(err.message));
  }, [id]);
  useEffect(() => { load(); }, [load]);

  if (error && !land) return <Alert variant="error">{error}</Alert>;
  if (!land) return <LoadingState label="Loading land…" />;

  const canUpdate = hasPermission('lands:update');
  const canDelete = hasPermission('lands:delete');
  const place = [land.address, land.city, land.region, land.country].filter(Boolean).join(', ');

  const changeStatus = async (status) => {
    setStatusError(null);
    try { await landsApi.update(id, { status }); load(); } catch (err) { setStatusError(err.message); }
  };

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <BackLink to="/lands">Back to lands</BackLink>
      {error && <Alert variant="error">{error}</Alert>}

      <DetailHeader
        icon={LandPlot}
        imageUrl={land.coverImageUrl}
        avatarUrl={land.coverImageUrl}
        title={land.title}
        badges={<Badge tone={LAND_STATUS[land.status]?.tone ?? 'neutral'}>{LAND_STATUS[land.status]?.label ?? land.status}</Badge>}
        subtitle={place ? <><MapPin size={14} className="mt-0.5 shrink-0" aria-hidden="true" /><span className="min-w-0">{place}</span></> : null}
        actions={(
          <>
            {canUpdate && <Button variant="secondary" onClick={() => setEditOpen(true)}><Pencil size={15} aria-hidden="true" />Edit</Button>}
            {canDelete && <Button variant="danger" onClick={() => setDeleteOpen(true)}><Trash2 size={15} aria-hidden="true" />Delete</Button>}
          </>
        )}
      />

      <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-6 xl:col-span-2">
          <Section title="Price and size">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">{formatCurrency(land.price)}</p>
              {canUpdate && ['available', 'unavailable'].includes(land.status) && (
                <select
                  aria-label="Availability"
                  value={land.status}
                  onChange={(e) => changeStatus(e.target.value)}
                  className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  <option value="available">Available</option>
                  <option value="unavailable">Not for sale</option>
                </select>
              )}
            </div>
            {statusError && <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{statusError}</p>}
            <div className="mt-4">
              <InfoGrid cols={3} items={[
                { icon: Ruler, label: 'Size', value: `${land.area} ${land.areaUnit}` },
                { icon: Tag, label: 'Type', value: labelFor(LAND_TYPES, land.landType) },
                { icon: FileCheck2, label: 'Documents', value: land.titleDocument },
              ]} />
            </div>
          </Section>

          {land.description && (
            <Section title="About this land">
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-600 dark:text-slate-300">{land.description}</p>
            </Section>
          )}

          <Section title="Photos & videos" description="Shown on the website to people who want to buy">
            <MediaGallery entityType="land" entityId={id} canUpload={canUpdate} canDelete={canUpdate} onChange={load} />
          </Section>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Section title="Details">
            <InfoGrid cols={1} items={[
              { icon: Wallet, label: 'Price', value: formatCurrency(land.price) },
              { icon: UserCircle, label: 'Belongs to', value: land.ownerName ?? 'The company' },
              { icon: MapPinned, label: 'Location', value: place || null },
              { icon: Compass, label: 'Coordinates', value: land.latitude != null && land.longitude != null ? `${land.latitude}, ${land.longitude}` : null },
            ]} />
          </Section>
          <Section title="Features">
            <ChipList items={land.features} empty="No features listed." />
          </Section>
        </div>
      </div>

      <LandFormModal open={editOpen} onClose={() => setEditOpen(false)} onSaved={load} land={land} />
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={async () => { await landsApi.remove(id); navigate('/lands', { replace: true }); }}
        title="Delete this land?"
        description={`This permanently deletes "${land.title}" and its photos and videos. This cannot be undone.`}
        confirmLabel="Delete"
      />
    </div>
  );
}
