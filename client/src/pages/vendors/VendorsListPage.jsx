import { useCallback, useEffect, useState } from 'react';
import { Plus, Search, Wrench, Phone, Mail, MapPin, CheckCircle2, UserMinus } from 'lucide-react';
import { Card, CardBody } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Field, SelectField } from '../../components/ui/Input.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { LoadingState } from '../../components/ui/Spinner.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { StatCard } from '../../components/ui/StatCard.jsx';
import { EntityCard } from '../../components/ui/EntityCard.jsx';
import { VendorFormModal } from '../../components/vendors/VendorFormModal.jsx';
import { vendorsApi } from '../../api/vendors.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useStatusCounts } from '../../hooks/useStatusCounts.js';
import { CAN_MANAGE_VENDORS, canAny, hasPermission } from '../../config/capabilities.js';

const STATUS_TONE = { active: 'success', inactive: 'neutral' };
const STATUS_LIST = ['active', 'inactive'];

function initialsOf(v) {
  return (v.name ?? '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

export default function VendorsListPage() {
  const { user } = useAuth();
  const canManage = canAny(user?.roles ?? [], CAN_MANAGE_VENDORS);

  const [vendors, setVendors] = useState([]);
  const [meta, setMeta] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formState, setFormState] = useState(null);
  const statusCounts = useStatusCounts(vendorsApi.list, STATUS_LIST, [meta.total]);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    vendorsApi.list({ page, pageSize: 20, search: search || undefined, status: status || undefined })
      .then((res) => { setVendors(res.data); setMeta(res.meta); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [page, search, status]);

  useEffect(() => { load(); }, [load]);

  const onSearchSubmit = (e) => { e.preventDefault(); setPage(1); load(); };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Wrench}
        eyebrow="Vendor Management"
        title="Vendors"
        description="Manage your vendor directory and service providers."
        action={canManage && (
          <Button onClick={() => setFormState('new')}>
            <Plus size={16} aria-hidden="true" />
            New vendor
          </Button>
        )}
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={Wrench} label="Total Vendors" value={statusCounts?.total ?? '—'} subtext="In directory" tone="brand" />
        <StatCard icon={CheckCircle2} label="Active" value={statusCounts?.active ?? '—'} subtext="Currently active" tone="success" />
        <StatCard icon={UserMinus} label="Inactive" value={statusCounts?.inactive ?? '—'} subtext="Not currently active" tone="warning" />
        <StatCard icon={Wrench} label="Service Types" value={new Set(vendors.map((v) => v.serviceType).filter(Boolean)).size} subtext="On this page" tone="neutral" />
      </div>

      <Card>
        <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <form onSubmit={onSearchSubmit} className="flex-1">
            <Field label="Search" placeholder="Search by name, email, or phone…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </form>
          <SelectField label="Status" className="sm:w-48" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </SelectField>
          <Button variant="secondary" onClick={onSearchSubmit}>
            <Search size={16} aria-hidden="true" />
            Search
          </Button>
        </CardBody>
      </Card>

      {error && <Alert variant="error">{error}</Alert>}

      {loading ? (
        <Card><LoadingState label="Loading vendors…" /></Card>
      ) : vendors.length === 0 ? (
        <Card>
          <CardBody className="flex flex-col items-center gap-2 py-16 text-center">
            <Wrench size={28} className="text-slate-300 dark:text-slate-700" aria-hidden="true" />
            <p className="text-sm text-slate-500 dark:text-slate-400">No vendors found.</p>
          </CardBody>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {vendors.map((v) => (
              <EntityCard
                key={v.id}
                imageUrl={v.coverImageUrl}
                initials={initialsOf(v)}
                badge={<Badge tone={STATUS_TONE[v.status] ?? 'neutral'} className="shadow-sm">{v.status}</Badge>}
                title={v.name}
                subtitle={v.serviceType || v.contactPerson || 'No service type on file'}
                infoItems={[
                  { icon: Mail, label: 'Email', value: v.email || '—' },
                  { icon: Phone, label: 'Phone', value: v.phone || '—' },
                  { icon: Wrench, label: 'Contact', value: v.contactPerson || '—' },
                  { icon: MapPin, label: 'Address', value: v.address || '—' },
                ]}
                onAction={() => setFormState(v)}
                actionLabel={hasPermission('vendors:update') ? 'View profile' : 'View'}
              />
            ))}
          </div>
          <Card>
            <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} pageSize={meta.pageSize} onPageChange={setPage} />
          </Card>
        </>
      )}

      <VendorFormModal open={Boolean(formState)} onClose={() => setFormState(null)} onSaved={load} vendor={formState === 'new' ? null : formState} />
    </div>
  );
}
