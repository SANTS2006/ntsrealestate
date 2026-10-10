import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, MapPin, Building2, Layers, Home, Users, CheckCircle2, Construction, Archive } from 'lucide-react';
import { Card, CardBody } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Field, SelectField } from '../../components/ui/Input.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { LoadingState } from '../../components/ui/Spinner.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { StatCard } from '../../components/ui/StatCard.jsx';
import { PropertyFormModal } from '../../components/properties/PropertyFormModal.jsx';
import { propertiesApi } from '../../api/properties.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useStatusCounts } from '../../hooks/useStatusCounts.js';
import { CAN_CREATE_PROPERTIES, canAny } from '../../config/capabilities.js';
import { structureOf } from '../../config/propertyStructures.js';

const STATUS_LIST = ['active', 'under_construction', 'archived'];

const STATUS_TONE = { active: 'success', archived: 'neutral', under_construction: 'warning' };

function PropertyCard({ property }) {
  const unitSummary = property.unitSummary ?? { total: 0, occupied: 0 };
  const kind = structureOf(property.structureType);
  const rented = unitSummary.total > 0 && unitSummary.occupied === unitSummary.total && !property.isShared;
  const occupancyRate = unitSummary.total > 0 ? Math.round((unitSummary.occupied / unitSummary.total) * 100) : null;

  return (
    <Link
      to={`/properties/${property.id}`}
      className="group flex min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden bg-gradient-to-br from-brand-100 to-accent-100 dark:from-brand-950 dark:to-accent-950">
        {property.coverImageUrl ? (
          <img
            src={property.coverImageUrl}
            alt={property.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Building2 size={36} className="text-brand-300 dark:text-brand-700" aria-hidden="true" />
          </div>
        )}
        {rented && <Badge tone="warning" className="absolute left-2.5 top-2.5 shadow-sm">Rented</Badge>}
        <Badge tone={STATUS_TONE[property.status] ?? 'neutral'} className="absolute right-2.5 top-2.5 shadow-sm">
          {property.status.replace('_', ' ')}
        </Badge>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <div className="flex items-center gap-2">
            <p className="min-w-0 truncate font-semibold text-slate-900 dark:text-slate-100">{property.name}</p>
            <span className="shrink-0 font-mono text-xs text-slate-400">{property.propertyCode}</span>
          </div>
          <p className="mt-0.5 flex items-center gap-1 truncate text-sm text-slate-500 dark:text-slate-400">
            <MapPin size={13} className="shrink-0" aria-hidden="true" />
            {[property.address, property.city, property.region].filter(Boolean).join(', ') || 'No address on file'}
          </p>
          <p className="mt-1.5 inline-flex max-w-full items-center gap-1 truncate rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700 dark:bg-brand-950 dark:text-brand-300">
            <kind.icon size={11} className="shrink-0" aria-hidden="true" />
            <span className="truncate">{kind.label}</span>
          </p>
        </div>

        <div className="mt-auto grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-center dark:border-slate-800">
          <div>
            <p className="flex items-center justify-center gap-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <Layers size={13} className="text-brand-500" aria-hidden="true" />
              {property.buildingCount ?? 0}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Buildings</p>
          </div>
          <div>
            <p className="flex items-center justify-center gap-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <Home size={13} className="text-brand-500" aria-hidden="true" />
              {unitSummary.total}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Units</p>
          </div>
          <div>
            <p className="flex items-center justify-center gap-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <Users size={13} className="text-brand-500" aria-hidden="true" />
              {occupancyRate == null ? '—' : `${occupancyRate}%`}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Occupied</p>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function PropertiesListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canCreate = canAny(user?.roles ?? [], CAN_CREATE_PROPERTIES);

  const [properties, setProperties] = useState([]);
  const [meta, setMeta] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const statusCounts = useStatusCounts(propertiesApi.list, STATUS_LIST, [meta.total]);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    propertiesApi.list({ page, pageSize: 20, search: search || undefined, status: status || undefined })
      .then((res) => { setProperties(res.data); setMeta(res.meta); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [page, search, status]);

  useEffect(() => { load(); }, [load]);

  const onSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    load();
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Building2}
        eyebrow="Property Management"
        title="Properties"
        description="Manage your property portfolio, buildings, and units from one place."
        action={canCreate && (
          <Button onClick={() => setFormOpen(true)}>
            <Plus size={16} aria-hidden="true" />
            New property
          </Button>
        )}
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={Building2} label="Total Properties" value={statusCounts?.total ?? '—'} subtext="Registered properties" tone="brand" />
        <StatCard icon={CheckCircle2} label="Active" value={statusCounts?.active ?? '—'} subtext="Currently active" tone="success" />
        <StatCard icon={Construction} label="Under Construction" value={statusCounts?.under_construction ?? '—'} subtext="In progress" tone="warning" />
        <StatCard icon={Archive} label="Archived" value={statusCounts?.archived ?? '—'} subtext="No longer active" tone="neutral" />
      </div>

      <Card>
        <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <form onSubmit={onSearchSubmit} className="flex-1">
            <Field
              label="Search"
              placeholder="Search by name, code, or address…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </form>
          <SelectField label="Status" className="sm:w-48" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="under_construction">Under construction</option>
            <option value="archived">Archived</option>
          </SelectField>
          <Button variant="secondary" onClick={onSearchSubmit}>
            <Search size={16} aria-hidden="true" />
            Search
          </Button>
        </CardBody>
      </Card>

      {error && <Alert variant="error">{error}</Alert>}

      {loading ? (
        <Card><LoadingState label="Loading properties…" /></Card>
      ) : properties.length === 0 ? (
        <Card>
          <CardBody className="flex flex-col items-center gap-2 py-16 text-center">
            <Building2 size={28} className="text-slate-300 dark:text-slate-700" aria-hidden="true" />
            <p className="text-sm text-slate-500 dark:text-slate-400">No properties found.</p>
          </CardBody>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {properties.map((p) => <PropertyCard key={p.id} property={p} />)}
          </div>
          <Card>
            <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} pageSize={meta.pageSize} onPageChange={setPage} />
          </Card>
        </>
      )}

      <PropertyFormModal open={formOpen} onClose={() => setFormOpen(false)} onSaved={(created) => { load(); if (created?.id) navigate(`/properties/${created.id}`); }} />
    </div>
  );
}
