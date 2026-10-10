import { useCallback, useEffect, useState } from 'react';
import { Plus, Search, Users, Mail, Phone, Building2, CheckCircle2, UserX, UserMinus } from 'lucide-react';
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
import { TenantFormModal } from '../../components/tenants/TenantFormModal.jsx';
import { tenantsApi } from '../../api/tenants.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useStatusCounts } from '../../hooks/useStatusCounts.js';
import { CAN_MANAGE_TENANTS, canAny } from '../../config/capabilities.js';

const STATUS_TONE = { active: 'success', inactive: 'neutral', former: 'danger' };
const STATUS_LIST = ['active', 'inactive', 'former'];

function initialsOf(t) {
  return `${t.firstName?.[0] ?? ''}${t.lastName?.[0] ?? ''}`.toUpperCase();
}

export default function TenantsListPage() {
  const { user } = useAuth();
  const canManage = canAny(user?.roles ?? [], CAN_MANAGE_TENANTS);

  const [tenants, setTenants] = useState([]);
  const [meta, setMeta] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formState, setFormState] = useState(null); // null | 'new' | tenant object
  const statusCounts = useStatusCounts(tenantsApi.list, STATUS_LIST, [meta.total]);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    tenantsApi.list({ page, pageSize: 20, search: search || undefined, status: status || undefined })
      .then((res) => { setTenants(res.data); setMeta(res.meta); })
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
        icon={Users}
        eyebrow="Tenant Management"
        title="Tenants"
        description="Manage tenant records, residences, and contact information."
        action={canManage && (
          <Button onClick={() => setFormState('new')}>
            <Plus size={16} aria-hidden="true" />
            New tenant
          </Button>
        )}
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={Users} label="Total Tenants" value={statusCounts?.total ?? '—'} subtext="Registered tenants" tone="brand" />
        <StatCard icon={CheckCircle2} label="Active" value={statusCounts?.active ?? '—'} subtext="Currently active" tone="success" />
        <StatCard icon={UserMinus} label="Inactive" value={statusCounts?.inactive ?? '—'} subtext="Not currently active" tone="warning" />
        <StatCard icon={UserX} label="Former" value={statusCounts?.former ?? '—'} subtext="No longer tenants" tone="danger" />
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
            <option value="former">Former</option>
          </SelectField>
          <Button variant="secondary" onClick={onSearchSubmit}>
            <Search size={16} aria-hidden="true" />
            Search
          </Button>
        </CardBody>
      </Card>

      {error && <Alert variant="error">{error}</Alert>}

      {loading ? (
        <Card><LoadingState label="Loading tenants…" /></Card>
      ) : tenants.length === 0 ? (
        <Card>
          <CardBody className="flex flex-col items-center gap-2 py-16 text-center">
            <Users size={28} className="text-slate-300 dark:text-slate-700" aria-hidden="true" />
            <p className="text-sm text-slate-500 dark:text-slate-400">No tenants found.</p>
          </CardBody>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {tenants.map((t) => (
              <EntityCard
                key={t.id}
                imageUrl={t.coverImageUrl}
                initials={initialsOf(t)}
                badge={<span className="flex flex-col items-end gap-1"><Badge tone={STATUS_TONE[t.status] ?? 'neutral'} className="shadow-sm">{t.status}</Badge>{t.accountStatus === 'pending' && <Badge tone="warning" className="shadow-sm">Invite pending</Badge>}</span>}
                title={`${t.firstName} ${t.lastName}`}
                subtitle={t.email || t.phone || 'No contact on file'}
                infoItems={[
                  { icon: Mail, label: 'Email', value: t.email || '—' },
                  { icon: Phone, label: 'Phone', value: t.phone || '—' },
                  { icon: Building2, label: 'Building', value: t.buildingName || 'Not linked' },
                  { icon: Building2, label: 'Unit', value: t.unitNumber || '—' },
                ]}
                onAction={() => setFormState(t)}
                actionLabel="View profile"
              />
            ))}
          </div>
          <Card>
            <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} pageSize={meta.pageSize} onPageChange={setPage} />
          </Card>
        </>
      )}

      <TenantFormModal
        open={Boolean(formState)}
        onClose={() => setFormState(null)}
        onSaved={load}
        tenant={formState === 'new' ? null : formState}
      />
    </div>
  );
}
