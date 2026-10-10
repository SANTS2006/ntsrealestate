import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LandPlot, Plus, Search, MapPin, Ruler, Wallet } from 'lucide-react';
import { Card, CardBody } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { Field, SelectField } from '../../components/ui/Input.jsx';
import { LoadingState } from '../../components/ui/Spinner.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { StatCard } from '../../components/ui/StatCard.jsx';
import { LandFormModal } from '../../components/lands/LandFormModal.jsx';
import { landsApi } from '../../api/lands.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useStatusCounts } from '../../hooks/useStatusCounts.js';
import { hasPermission } from '../../config/capabilities.js';
import { LAND_STATUS, LAND_TYPES, labelFor } from '../../config/dealLabels.js';
import { formatCurrency } from '../../utils/currency.js';

const STATUSES = ['available', 'reserved', 'sold'];

function LandCard({ land }) {
  return (
    <Link
      to={`/lands/${land.id}`}
      className="group flex min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden bg-gradient-to-br from-brand-100 to-accent-100 dark:from-brand-950 dark:to-accent-950">
        {land.coverImageUrl ? (
          <img src={land.coverImageUrl} alt={land.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
        ) : (
          <div className="flex h-full w-full items-center justify-center"><LandPlot size={36} className="text-brand-300 dark:text-brand-700" aria-hidden="true" /></div>
        )}
        <Badge tone={LAND_STATUS[land.status]?.tone ?? 'neutral'} className="absolute right-2.5 top-2.5 shadow-sm">{LAND_STATUS[land.status]?.label ?? land.status}</Badge>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2 p-4">
        <p className="truncate font-semibold text-slate-900 dark:text-slate-100">{land.title}</p>
        <p className="flex items-center gap-1 truncate text-sm text-slate-500 dark:text-slate-400">
          <MapPin size={13} className="shrink-0" aria-hidden="true" />
          {[land.city, land.region].filter(Boolean).join(', ') || 'Location not set'}
        </p>
        <div className="mt-auto grid grid-cols-2 gap-2 pt-2">
          <span className="flex min-w-0 items-center gap-1.5 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
            <Ruler size={13} className="shrink-0 text-brand-500" aria-hidden="true" /><span className="truncate">{land.area} {land.areaUnit}</span>
          </span>
          <span className="flex min-w-0 items-center gap-1.5 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-200">
            <Wallet size={13} className="shrink-0 text-brand-500" aria-hidden="true" /><span className="truncate">{formatCurrency(land.price)}</span>
          </span>
        </div>
        <p className="truncate text-xs text-slate-400">{labelFor(LAND_TYPES, land.landType)}{land.ownerName ? ` · ${land.ownerName}` : ''}</p>
      </div>
    </Link>
  );
}

// Lands for sale: the company's own lands and those of its owners, each with
// photos, videos and full specifications. Available lands show on the website.
export default function LandsListPage() {
  useDocumentTitle('Lands');
  const navigate = useNavigate();
  const canCreate = hasPermission('lands:create');
  const [lands, setLands] = useState([]);
  const [meta, setMeta] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const counts = useStatusCounts(landsApi.list, STATUSES, [meta.total]);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    landsApi.list({ page, pageSize: 20, search: search || undefined, status: status || undefined })
      .then((res) => { setLands(res.data); setMeta(res.meta); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [page, search, status]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader
        icon={LandPlot}
        eyebrow="Sales"
        title="Lands"
        description="Lands for sale, with photos, videos and full specifications."
        action={canCreate && (
          <Button onClick={() => setFormOpen(true)}>
            <Plus size={16} aria-hidden="true" />
            Add land
          </Button>
        )}
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={LandPlot} label="All lands" value={counts?.total ?? '—'} subtext="In your list" tone="brand" />
        <StatCard icon={LandPlot} label="Available" value={counts?.available ?? '—'} subtext="Shown on the website" tone="success" />
        <StatCard icon={LandPlot} label="Reserved" value={counts?.reserved ?? '—'} subtext="Someone is buying" tone="warning" />
        <StatCard icon={LandPlot} label="Sold" value={counts?.sold ?? '—'} subtext="Completed sales" tone="neutral" />
      </div>

      <Card>
        <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <form onSubmit={(e) => { e.preventDefault(); setPage(1); load(); }} className="flex-1">
            <Field label="Search" placeholder="Search by title, city or region…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </form>
          <SelectField label="Status" className="sm:w-48" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            <option value="available">Available</option>
            <option value="reserved">Reserved</option>
            <option value="sold">Sold</option>
            <option value="unavailable">Unavailable</option>
          </SelectField>
          <Button variant="secondary" onClick={() => { setPage(1); load(); }}>
            <Search size={16} aria-hidden="true" />
            Search
          </Button>
        </CardBody>
      </Card>

      {error && <Alert variant="error">{error}</Alert>}

      {loading ? (
        <Card><LoadingState label="Loading lands…" /></Card>
      ) : lands.length === 0 ? (
        <Card>
          <CardBody className="flex flex-col items-center gap-2 py-16 text-center">
            <LandPlot size={28} className="text-slate-300 dark:text-slate-700" aria-hidden="true" />
            <p className="text-sm text-slate-500 dark:text-slate-400">No lands found.</p>
          </CardBody>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {lands.map((l) => <LandCard key={l.id} land={l} />)}
          </div>
          <Card><Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} pageSize={meta.pageSize} onPageChange={setPage} /></Card>
        </>
      )}

      <LandFormModal open={formOpen} onClose={() => setFormOpen(false)} onSaved={(created) => { load(); if (created?.id) navigate(`/lands/${created.id}`); }} />
    </div>
  );
}
