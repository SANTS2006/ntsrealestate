import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, Plus, ExternalLink, ShieldOff, CheckCircle2, Search, Eye } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { Table, Thead, Tbody, Tr, Th, Td } from '../../components/ui/Table.jsx';
import { LoadingState } from '../../components/ui/Spinner.jsx';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { platformAdminApi } from '../../api/platformAdmin.js';
import { CreateOrganizationModal } from './CreateOrganizationModal.jsx';
import { OrganizationDetailModal } from './OrganizationDetailModal.jsx';

const APP_ORIGIN = window.location.origin;
const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Deactivated' },
];

export default function PlatformAdminOrganizationsPage() {
  useDocumentTitle('Organizations — Platform Admin');
  const [organizations, setOrganizations] = useState(null);
  const [error, setError] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [pendingStatusChange, setPendingStatusChange] = useState(null); // { org, nextStatus }
  const [justCreated, setJustCreated] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const load = useCallback(() => {
    setError(null);
    platformAdminApi.listOrganizations()
      .then((res) => setOrganizations(res.data))
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (organizations ?? []).filter((org) =>
      (statusFilter === 'all' || org.status === statusFilter)
      && (!q || org.name.toLowerCase().includes(q) || org.slug.includes(q) || org.email.toLowerCase().includes(q)));
  }, [organizations, search, statusFilter]);

  const onCreated = ({ organization, loginUrl }) => {
    setJustCreated({ organization, loginUrl });
    load();
  };

  const confirmStatusChange = async () => {
    if (!pendingStatusChange) return;
    await platformAdminApi.setOrganizationStatus(pendingStatusChange.org.id, pendingStatusChange.nextStatus);
    load();
  };

  return (
    <>
      <PageHeader
        icon={Building2}
        eyebrow="Platform"
        title="Organizations"
        description="Every real estate company running on NTS Real Estate System."
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus size={16} aria-hidden="true" />
            Add organization
          </Button>
        }
      />

      {justCreated && (
        <Alert variant="success" className="mt-6" title={`${justCreated.organization.name} created`}>
          <p>The administrator has been emailed their login details.</p>
          <a href={justCreated.loginUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 font-medium underline">
            Open their login page <ExternalLink size={13} aria-hidden="true" />
          </a>
        </Alert>
      )}

      {error && <Alert variant="error" className="mt-6">{error}</Alert>}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, URL or email"
            aria-label="Search organizations"
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>
        <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900" role="group" aria-label="Filter by status">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setStatusFilter(f.value)}
              aria-pressed={statusFilter === f.value}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${statusFilter === f.value ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {organizations === null && !error && <div className="p-8"><LoadingState label="Loading organizations…" /></div>}

        {organizations?.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
            <Building2 size={32} className="text-slate-300 dark:text-slate-700" aria-hidden="true" />
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">No organizations yet</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Add the first one to get started.</p>
          </div>
        )}

        {organizations?.length > 0 && visible.length === 0 && (
          <p className="px-6 py-12 text-center text-sm text-slate-500 dark:text-slate-400">No organizations match your search.</p>
        )}

        {visible.length > 0 && (
          <>
          {/* Phones: one card per organization, every action reachable without sideways scrolling. */}
          <ul className="divide-y divide-slate-100 md:hidden dark:divide-slate-800">
            {visible.map((org) => (
              <li key={org.id} className="flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <button type="button" onClick={() => setDetailId(org.id)} className="flex min-w-0 items-center gap-2 text-left">
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: org.primaryColor }} aria-hidden="true" />
                    <span className="truncate font-medium text-slate-900 dark:text-slate-100">{org.name}</span>
                  </button>
                  <Badge tone={org.status === 'active' ? 'success' : 'danger'}>{org.status === 'active' ? 'Active' : 'Deactivated'}</Badge>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
                  <a href={`${APP_ORIGIN}/${org.slug}/login`} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-1 text-brand-600 dark:text-brand-400">
                    <span className="truncate">/{org.slug}</span> <ExternalLink size={12} aria-hidden="true" />
                  </a>
                  <span>{org.userCount ?? 0} users</span>
                  <span>{new Date(org.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" className="flex-1" onClick={() => setDetailId(org.id)}><Eye size={14} aria-hidden="true" />Details</Button>
                  {org.status === 'active' ? (
                    <Button variant="danger" size="sm" className="flex-1" onClick={() => setPendingStatusChange({ org, nextStatus: 'suspended' })}><ShieldOff size={14} aria-hidden="true" />Deactivate</Button>
                  ) : (
                    <Button variant="secondary" size="sm" className="flex-1" onClick={() => setPendingStatusChange({ org, nextStatus: 'active' })}><CheckCircle2 size={14} aria-hidden="true" />Reactivate</Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <div className="hidden md:block">
          <Table>
            <Thead>
              <Tr>
                <Th>Organization</Th>
                <Th>URL</Th>
                <Th>Users</Th>
                <Th>Status</Th>
                <Th>Created</Th>
                <Th className="text-right">Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {visible.map((org) => (
                <Tr key={org.id}>
                  <Td>
                    <button type="button" onClick={() => setDetailId(org.id)} className="flex items-center gap-2 text-left">
                      <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: org.primaryColor }} aria-hidden="true" />
                      <span className="font-medium text-slate-900 hover:underline dark:text-slate-100">{org.name}</span>
                    </button>
                  </Td>
                  <Td>
                    <a href={`${APP_ORIGIN}/${org.slug}/login`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-brand-600 hover:underline dark:text-brand-400">
                      /{org.slug} <ExternalLink size={12} aria-hidden="true" />
                    </a>
                  </Td>
                  <Td>{org.userCount ?? '—'}</Td>
                  <Td>
                    <Badge tone={org.status === 'active' ? 'success' : 'danger'}>
                      {org.status === 'active' ? 'Active' : 'Deactivated'}
                    </Badge>
                  </Td>
                  <Td>{new Date(org.createdAt).toLocaleDateString()}</Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="secondary" size="sm" onClick={() => setDetailId(org.id)}>
                        <Eye size={14} aria-hidden="true" />
                        Details
                      </Button>
                      {org.status === 'active' ? (
                        <Button variant="danger" size="sm" onClick={() => setPendingStatusChange({ org, nextStatus: 'suspended' })}>
                          <ShieldOff size={14} aria-hidden="true" />
                          Deactivate
                        </Button>
                      ) : (
                        <Button variant="secondary" size="sm" onClick={() => setPendingStatusChange({ org, nextStatus: 'active' })}>
                          <CheckCircle2 size={14} aria-hidden="true" />
                          Reactivate
                        </Button>
                      )}
                    </div>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
          </div>
          </>
        )}
      </div>

      <CreateOrganizationModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={onCreated} />
      <OrganizationDetailModal orgId={detailId} onClose={() => setDetailId(null)} onChanged={load} />

      <ConfirmDialog
        open={Boolean(pendingStatusChange)}
        onClose={() => setPendingStatusChange(null)}
        onConfirm={confirmStatusChange}
        title={pendingStatusChange?.nextStatus === 'active' ? 'Reactivate organization?' : 'Deactivate organization?'}
        description={
          pendingStatusChange?.nextStatus === 'active'
            ? `${pendingStatusChange?.org.name} will be able to sign in again.`
            : `${pendingStatusChange?.org.name} will lose all access immediately — no one there will be able to sign in until you reactivate it.`
        }
        confirmLabel={pendingStatusChange?.nextStatus === 'active' ? 'Reactivate' : 'Deactivate'}
        variant={pendingStatusChange?.nextStatus === 'active' ? 'primary' : 'danger'}
      />
    </>
  );
}
