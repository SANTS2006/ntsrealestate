import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Pencil, Archive, Plus, MapPin, Building2, Layers, Home, CheckCircle2, Wallet, Bed, Bath, Ruler, Sofa, Tag, Hash, CalendarDays, Compass, DoorOpen } from 'lucide-react';
import { Button } from '../../components/ui/Button.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { LoadingState } from '../../components/ui/Spinner.jsx';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.jsx';
import { StatCard } from '../../components/ui/StatCard.jsx';
import { BackLink, DetailHeader, Section, InfoGrid, ChipList, EmptyPanel } from '../../components/ui/Detail.jsx';
import { PropertyFormModal } from '../../components/properties/PropertyFormModal.jsx';
import { BuildingFormModal } from '../../components/properties/BuildingFormModal.jsx';
import { BuildingCard } from '../../components/properties/BuildingCard.jsx';
import { BuildingUnitsModal } from '../../components/properties/BuildingUnitsModal.jsx';
import { UnitsPanel } from '../../components/properties/UnitsPanel.jsx';
import { UnitFormModal } from '../../components/properties/UnitFormModal.jsx';
import { MediaGallery } from '../../components/media/MediaGallery.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { propertiesApi } from '../../api/properties.js';
import { buildingsApi } from '../../api/buildings.js';
import { unitsApi } from '../../api/units.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { formatCurrency } from '../../utils/currency.js';
import { structureOf } from '../../config/propertyStructures.js';
import {
  CAN_UPDATE_PROPERTIES, CAN_DELETE_PROPERTIES, CAN_MANAGE_BUILDINGS,
  CAN_UPLOAD_DOCUMENTS, CAN_DELETE_DOCUMENTS, canAny, hasPermission,
} from '../../config/capabilities.js';

const STATUS_TONE = { active: 'success', archived: 'neutral', under_construction: 'warning' };
const UNIT_STATUS_TONE = { available: 'success', occupied: 'brand', reserved: 'warning', under_maintenance: 'warning', unavailable: 'neutral' };
const MANUALLY_SETTABLE = ['available', 'reserved', 'under_maintenance', 'unavailable'];

// The price and details of a whole property (stored on its one automatic unit).
function WholePropertyPanel({ unit, canEdit, onEdit, onStatusChange, onEndRental, statusError }) {
  if (!unit) return <EmptyPanel icon={Home}>No price has been set for this property yet.</EmptyPanel>;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">{formatCurrency(unit.monthlyRent)}<span className="text-base font-medium text-slate-500"> / month</span></p>
          {unit.securityDeposit != null && <p className="text-sm text-slate-500 dark:text-slate-400">Security deposit {formatCurrency(unit.securityDeposit)}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={UNIT_STATUS_TONE[unit.status] ?? 'neutral'}>{unit.status === 'occupied' ? 'rented' : unit.status.replace('_', ' ')}</Badge>
          {canEdit && unit.status !== 'occupied' && (
            <select
              aria-label="Availability"
              value={unit.status}
              onChange={(e) => onStatusChange(e.target.value)}
              className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              {MANUALLY_SETTABLE.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
          )}
          {canEdit && unit.status === 'occupied' && <Button variant="secondary" size="sm" onClick={onEndRental}>End rental</Button>}
          {canEdit && <Button variant="secondary" size="sm" onClick={onEdit}><Pencil size={14} aria-hidden="true" />Edit price &amp; details</Button>}
        </div>
      </div>
      {statusError && <p className="text-sm text-rose-600 dark:text-rose-400">{statusError}</p>}
      <InfoGrid cols={4} items={[
        { icon: Bed, label: 'Bedrooms', value: unit.bedrooms },
        { icon: Bath, label: 'Bathrooms', value: unit.bathrooms },
        { icon: Ruler, label: 'Area', value: unit.area != null ? `${unit.area} sq ft` : null },
        { icon: Sofa, label: 'Furnished', value: unit.furnished ? 'Yes' : 'No' },
        { icon: Tag, label: 'Type', value: unit.unitType },
        { icon: Layers, label: 'Floors / level', value: unit.floor },
      ]} />
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Facilities</p>
        <ChipList items={unit.amenities} empty="No facilities listed." />
      </div>
    </div>
  );
}

export default function PropertyDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  const canUpdate = canAny(roles, CAN_UPDATE_PROPERTIES);
  const canDelete = canAny(roles, CAN_DELETE_PROPERTIES);
  const canManageBuildings = canAny(roles, CAN_MANAGE_BUILDINGS);
  const canUploadMedia = canAny(roles, CAN_UPLOAD_DOCUMENTS);
  const canDeleteMedia = canAny(roles, CAN_DELETE_DOCUMENTS);

  const [property, setProperty] = useState(null);
  const [buildings, setBuildings] = useState(null);
  const [error, setError] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [buildingFormState, setBuildingFormState] = useState(null); // null | 'new' | building object
  const [unitsBuilding, setUnitsBuilding] = useState(null);
  const [mediaBuilding, setMediaBuilding] = useState(null);
  const [wholeUnitForm, setWholeUnitForm] = useState(false);
  const [statusError, setStatusError] = useState(null);

  const structure = property?.structureType;
  const usesBuildings = structure === 'buildings' || structure === 'buildings_units';

  const loadProperty = useCallback(() => {
    propertiesApi.get(id).then((res) => setProperty(res.data)).catch((err) => setError(err.message));
  }, [id]);

  const loadBuildings = useCallback(() => {
    buildingsApi.list(id).then((res) => setBuildings(res.data)).catch((err) => setError(err.message));
  }, [id]);

  useEffect(() => { loadProperty(); }, [loadProperty]);
  useEffect(() => { if (structure && usesBuildings) loadBuildings(); }, [structure, usesBuildings, loadBuildings]);

  if (error && !property) return <Alert variant="error">{error}</Alert>;
  if (!property) return <LoadingState label="Loading property…" />;

  const kind = structureOf(structure);
  const summary = property.unitSummary;
  const fullyRented = summary.total > 0 && summary.occupied === summary.total && !property.isShared;
  const partlyRented = !fullyRented && summary.occupied > 0 && !property.isShared;
  const address = [property.address, property.city, property.region, property.country].filter(Boolean).join(', ');
  const wholeUnit = property.wholeUnit;

  const changeWholeStatus = async (status) => {
    setStatusError(null);
    try { await unitsApi.setStatus(wholeUnit.id, status); loadProperty(); } catch (err) { setStatusError(err.message); }
  };

  const stats = {
    whole: [
      { icon: Wallet, label: 'Price per month', value: wholeUnit ? formatCurrency(wholeUnit.monthlyRent) : '—', tone: 'brand' },
      { icon: Bed, label: 'Bedrooms', value: wholeUnit?.bedrooms ?? '—', tone: 'neutral' },
      { icon: Bath, label: 'Bathrooms', value: wholeUnit?.bathrooms ?? '—', tone: 'neutral' },
      { icon: CheckCircle2, label: 'Status', value: wholeUnit ? wholeUnit.status.replace('_', ' ') : '—', tone: wholeUnit?.status === 'available' ? 'success' : 'warning' },
    ],
    buildings: [
      { icon: Layers, label: 'Buildings', value: buildings?.length ?? '—', tone: 'brand' },
      { icon: Home, label: 'Rentable', value: summary.total, tone: 'brand' },
      { icon: CheckCircle2, label: 'Occupied', value: summary.occupied, tone: 'warning' },
      { icon: Home, label: 'Available', value: summary.available, tone: 'success' },
    ],
    buildings_units: [
      { icon: Layers, label: 'Buildings', value: buildings?.length ?? '—', tone: 'brand' },
      { icon: Home, label: 'Total units', value: summary.total, tone: 'brand' },
      { icon: CheckCircle2, label: 'Occupied', value: summary.occupied, tone: 'warning' },
      { icon: Home, label: 'Available', value: summary.available, tone: 'success' },
    ],
    units: [
      { icon: DoorOpen, label: 'Total units', value: summary.total, tone: 'brand' },
      { icon: CheckCircle2, label: 'Occupied', value: summary.occupied, tone: 'warning' },
      { icon: Home, label: 'Available', value: summary.available, tone: 'success' },
      { icon: Wallet, label: 'Reserved / other', value: Math.max(summary.total - summary.occupied - summary.available, 0), tone: 'neutral' },
    ],
  }[structure] ?? [];

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <BackLink to="/properties">Back to properties</BackLink>

      {error && <Alert variant="error">{error}</Alert>}

      <DetailHeader
        icon={Building2}
        imageUrl={property.coverImageUrl}
        avatarUrl={property.coverImageUrl}
        title={property.name}
        badges={(
          <>
            <Badge tone={STATUS_TONE[property.status] ?? 'neutral'}>{property.status.replace('_', ' ')}</Badge>
            {fullyRented && <Badge tone="warning">Rented</Badge>}
            {partlyRented && <Badge tone="warning">Partly rented</Badge>}
            {property.isShared && <Badge tone="neutral">Shared</Badge>}
            <Badge tone="brand"><kind.icon size={12} className="mr-1" aria-hidden="true" />{kind.label}</Badge>
          </>
        )}
        subtitle={address ? <><MapPin size={14} className="mt-0.5 shrink-0" aria-hidden="true" /><span className="min-w-0">{address}</span></> : null}
        actions={(
          <>
            {canUpdate && property.status !== 'archived' && (
              <Button variant="secondary" onClick={() => setEditOpen(true)}>
                <Pencil size={15} aria-hidden="true" />
                Edit
              </Button>
            )}
            {canDelete && property.status !== 'archived' && (
              <Button variant="danger" onClick={() => setArchiveOpen(true)}>
                <Archive size={15} aria-hidden="true" />
                Archive
              </Button>
            )}
          </>
        )}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => <StatCard key={s.label} {...s} />)}
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-6 xl:col-span-2">
          {structure === 'whole' && (
            <Section title="Price and details" description="What tenants see on the listing">
              <WholePropertyPanel
                unit={wholeUnit}
                canEdit={hasPermission('units:update') && property.status !== 'archived'}
                onEdit={() => setWholeUnitForm(true)}
                onStatusChange={changeWholeStatus}
                onEndRental={async () => { setStatusError(null); try { await unitsApi.endRental(wholeUnit.id); loadProperty(); } catch (err) { setStatusError(err.message); } }}
                statusError={statusError}
              />
            </Section>
          )}

          {structure === 'units' && property.implicitBuildingId && (
            <Section title="Units" description="Rooms, flats or shops in this property">
              <UnitsPanel buildingId={property.implicitBuildingId} onChanged={loadProperty} emptyText="No units yet. Add the first unit to start listing it." />
            </Section>
          )}

          {usesBuildings && (
            <Section
              title="Buildings"
              description={structure === 'buildings' ? 'Each building is rented as a whole' : 'Open a building to manage its units'}
              action={canManageBuildings && (
                <Button variant="secondary" size="sm" onClick={() => setBuildingFormState('new')}>
                  <Plus size={14} aria-hidden="true" />
                  Add building
                </Button>
              )}
            >
              {buildings === null ? (
                <LoadingState label="Loading buildings…" />
              ) : buildings.length === 0 ? (
                <EmptyPanel icon={Building2}>No buildings yet. Add the first building to get started.</EmptyPanel>
              ) : (
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 2xl:grid-cols-3">
                  {buildings.map((b) => (
                    <BuildingCard
                      key={b.id}
                      building={b}
                      rentable={structure === 'buildings'}
                      onOpenUnits={() => setUnitsBuilding(b)}
                      onEdit={() => setBuildingFormState(b)}
                      onOpenMedia={() => setMediaBuilding(b)}
                      onEndRental={async (unitId) => { await unitsApi.endRental(unitId); loadProperty(); }}
                      onDeleted={async (bid) => {
                        await buildingsApi.remove(bid);
                        setBuildings((prev) => prev.filter((x) => x.id !== bid));
                        loadProperty();
                      }}
                    />
                  ))}
                </div>
              )}
            </Section>
          )}

          <Section title="Photos & videos">
            <MediaGallery entityType="property" entityId={id} canUpload={canUploadMedia} canDelete={canDeleteMedia} onChange={loadProperty} />
          </Section>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Section title="About this property">
            <InfoGrid cols={1} items={[
              { icon: Hash, label: 'Property code', value: property.propertyCode, mono: true },
              { icon: Tag, label: 'Category', value: property.propertyType },
              { icon: CalendarDays, label: 'Year built', value: property.yearBuilt },
              { icon: Compass, label: 'Coordinates', value: property.latitude != null && property.longitude != null ? `${property.latitude}, ${property.longitude}` : null },
            ]} />
            {property.description && (
              <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-600 dark:text-slate-300">{property.description}</p>
            )}
          </Section>

          {property.amenities?.length > 0 && (
            <Section title="Shared facilities">
              <ChipList items={property.amenities} />
            </Section>
          )}
        </div>
      </div>

      <PropertyFormModal open={editOpen} onClose={() => setEditOpen(false)} onSaved={loadProperty} property={property} />
      <BuildingFormModal
        open={Boolean(buildingFormState)}
        onClose={() => setBuildingFormState(null)}
        onSaved={() => { loadBuildings(); loadProperty(); }}
        propertyId={id}
        structureType={structure}
        building={buildingFormState === 'new' ? null : buildingFormState}
      />
      <BuildingUnitsModal
        open={Boolean(unitsBuilding)}
        onClose={() => setUnitsBuilding(null)}
        building={unitsBuilding}
        onUnitsChanged={() => { loadBuildings(); loadProperty(); }}
      />
      {wholeUnit && (
        <UnitFormModal open={wholeUnitForm} onClose={() => setWholeUnitForm(false)} onSaved={loadProperty} buildingId={property.implicitBuildingId} unit={wholeUnit} />
      )}
      <Modal open={Boolean(mediaBuilding)} onClose={() => setMediaBuilding(null)} title={mediaBuilding ? `${mediaBuilding.name} — Photos & videos` : ''} size="lg">
        {mediaBuilding && (
          <MediaGallery
            entityType="building"
            entityId={mediaBuilding.id}
            canUpload={canUploadMedia}
            canDelete={canDeleteMedia}
            onChange={() => { loadBuildings(); loadProperty(); }}
          />
        )}
      </Modal>
      <ConfirmDialog
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        onConfirm={async () => { await propertiesApi.archive(id); navigate('/properties', { replace: true }); }}
        title="Archive property?"
        description={`This will archive "${property.name}". It can still be viewed but will no longer appear as active.`}
        confirmLabel="Archive"
      />
    </div>
  );
}
