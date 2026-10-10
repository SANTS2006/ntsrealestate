import { useCallback, useEffect, useState } from 'react';
import { hasPermission } from '../../config/capabilities.js';
import { Plus, FileText, Pencil, PlayCircle, RefreshCcw, XCircle, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Card, CardBody } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { SelectField } from '../../components/ui/Input.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { LoadingState } from '../../components/ui/Spinner.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { StatCard } from '../../components/ui/StatCard.jsx';
import { Table, Thead, Tbody, Tr, Th, Td } from '../../components/ui/Table.jsx';
import { DocumentsButton } from '../../components/media/DocumentsButton.jsx';
import { CreateLeaseModal } from '../../components/leases/CreateLeaseModal.jsx';
import { EditLeaseModal } from '../../components/leases/EditLeaseModal.jsx';
import { TerminateLeaseModal } from '../../components/leases/TerminateLeaseModal.jsx';
import { RenewLeaseModal } from '../../components/leases/RenewLeaseModal.jsx';
import { leasesApi } from '../../api/leases.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useStatusCounts } from '../../hooks/useStatusCounts.js';
import { CAN_MANAGE_LEASES, CAN_UPLOAD_DOCUMENTS, CAN_DELETE_DOCUMENTS, canAny } from '../../config/capabilities.js';
import { formatCurrency } from '../../utils/currency.js';

const STATUS_TONE = { draft: 'neutral', active: 'success', expiring_soon: 'warning', expired: 'neutral', terminated: 'danger', renewed: 'brand' };
const STATUS_LIST = ['active', 'expiring_soon', 'terminated'];
const dateFmt = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' });

export default function LeasesListPage() {
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  const canManage = canAny(roles, CAN_MANAGE_LEASES);
  const canUploadDocs = canAny(roles, CAN_UPLOAD_DOCUMENTS);
  const canDeleteDocs = canAny(roles, CAN_DELETE_DOCUMENTS);

  const [leases, setLeases] = useState([]);
  const [meta, setMeta] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [editLease, setEditLease] = useState(null);
  const [terminateLease, setTerminateLease] = useState(null);
  const [renewLease, setRenewLease] = useState(null);
  const [activateLease, setActivateLease] = useState(null);
  const statusCounts = useStatusCounts(leasesApi.list, STATUS_LIST, [meta.total]);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    leasesApi.list({ page, pageSize: 20, status: status || undefined })
      .then((res) => { setLeases(res.data); setMeta(res.meta); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [page, status]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={FileText}
        eyebrow="Lease Management"
        title="Leases"
        description="Manage tenant leases across your portfolio."
        action={canManage && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus size={16} aria-hidden="true" />
            New lease
          </Button>
        )}
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={FileText} label="Total Leases" value={statusCounts?.total ?? '—'} subtext="All leases" tone="brand" />
        <StatCard icon={CheckCircle2} label="Active" value={statusCounts?.active ?? '—'} subtext="Currently active" tone="success" />
        <StatCard icon={AlertTriangle} label="Expiring Soon" value={statusCounts?.expiring_soon ?? '—'} subtext="Within 30 days" tone="warning" />
        <StatCard icon={XCircle} label="Terminated" value={statusCounts?.terminated ?? '—'} subtext="Ended early" tone="danger" />
      </div>

      <Card>
        <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <SelectField label="Status" className="sm:w-56" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="expiring_soon">Expiring soon</option>
            <option value="expired">Expired</option>
            <option value="terminated">Terminated</option>
            <option value="renewed">Renewed</option>
          </SelectField>
        </CardBody>
      </Card>

      {error && <Alert variant="error">{error}</Alert>}

      <Card>
        {loading ? (
          <LoadingState label="Loading leases…" />
        ) : leases.length === 0 ? (
          <CardBody className="flex flex-col items-center gap-2 py-16 text-center">
            <FileText size={28} className="text-slate-300 dark:text-slate-700" aria-hidden="true" />
            <p className="text-sm text-slate-500 dark:text-slate-400">No leases found.</p>
          </CardBody>
        ) : (
          <>
            <Table>
              <Thead>
                <Tr>
                  <Th>Tenant</Th>
                  <Th>Unit</Th>
                  <Th>Term</Th>
                  <Th>Rent</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {leases.map((lease) => (
                  <Tr key={lease.id}>
                    <Td className="font-medium text-slate-900 dark:text-slate-100">
                      {lease.tenant ? `${lease.tenant.firstName} ${lease.tenant.lastName}` : 'Unknown tenant'}
                    </Td>
                    <Td className="max-w-[16rem]">
                      <span className="block truncate" title={lease.unit?.title}>{lease.unit?.title ?? 'Unknown unit'}</span>
                      {lease.terms?.kind === 'lease' && <Badge tone="warning" className="mt-1">Lease · {lease.terms.termMonths} months</Badge>}
                    </Td>
                    <Td className="whitespace-nowrap">{dateFmt.format(new Date(lease.startDate))} – {dateFmt.format(new Date(lease.endDate))}</Td>
                    <Td className="whitespace-nowrap">{formatCurrency(lease.monthlyRent)}/mo</Td>
                    <Td><Badge tone={STATUS_TONE[lease.status] ?? 'neutral'}>{lease.status.replace('_', ' ')}</Badge></Td>
                    <Td>
                      <div className="flex items-center justify-end gap-2">
                        <DocumentsButton
                          entityType="lease"
                          entityId={lease.id}
                          canUpload={canUploadDocs}
                          canDelete={canDeleteDocs}
                          title={`Lease — ${lease.tenant ? `${lease.tenant.firstName} ${lease.tenant.lastName}` : 'Documents'}`}
                        />
                        {canManage && (
                          <>
                            {lease.status === 'draft' && hasPermission('leases:update') && (
                              <>
                                <Button variant="secondary" size="sm" onClick={() => setEditLease(lease)}>
                                  <Pencil size={14} aria-hidden="true" />
                                  Edit
                                </Button>
                                <Button size="sm" onClick={() => setActivateLease(lease)}>
                                  <PlayCircle size={14} aria-hidden="true" />
                                  Activate
                                </Button>
                              </>
                            )}
                            {lease.status === 'active' && (
                              <>
                                {hasPermission('leases:update') && <Button variant="secondary" size="sm" onClick={() => setEditLease(lease)}>
                                  <Pencil size={14} aria-hidden="true" />
                                  Edit
                                </Button>}
                                {hasPermission('leases:renew') && <Button variant="secondary" size="sm" onClick={() => setRenewLease(lease)}>
                                  <RefreshCcw size={14} aria-hidden="true" />
                                  Renew
                                </Button>}
                                {hasPermission('leases:terminate') && <Button variant="danger" size="sm" onClick={() => setTerminateLease(lease)}>
                                  <XCircle size={14} aria-hidden="true" />
                                  Terminate
                                </Button>}
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
            <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} pageSize={meta.pageSize} onPageChange={setPage} />
          </>
        )}
      </Card>

      <CreateLeaseModal open={createOpen} onClose={() => setCreateOpen(false)} onSaved={load} />
      <EditLeaseModal open={Boolean(editLease)} onClose={() => setEditLease(null)} onSaved={load} lease={editLease} />
      <TerminateLeaseModal open={Boolean(terminateLease)} onClose={() => setTerminateLease(null)} onSaved={load} lease={terminateLease} />
      <RenewLeaseModal open={Boolean(renewLease)} onClose={() => setRenewLease(null)} onSaved={load} lease={renewLease} />
      <ConfirmDialog
        open={Boolean(activateLease)}
        onClose={() => setActivateLease(null)}
        onConfirm={async () => { await leasesApi.activate(activateLease.id); load(); }}
        title="Activate lease?"
        description={activateLease ? `This marks ${activateLease.unit?.title ?? 'the unit'} as occupied and starts the lease.` : ''}
        confirmLabel="Activate"
        variant="primary"
      />
    </div>
  );
}
