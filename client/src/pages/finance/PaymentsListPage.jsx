import { useCallback, useEffect, useState } from 'react';
import { hasPermission } from '../../config/capabilities.js';
import { Plus, Wallet, RotateCcw, CheckCircle2, Clock, Receipt } from 'lucide-react';
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
import { RecordPaymentModal } from '../../components/finance/RecordPaymentModal.jsx';
import { paymentsApi } from '../../api/payments.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useStatusCounts } from '../../hooks/useStatusCounts.js';
import { CAN_MANAGE_PAYMENTS, CAN_UPLOAD_DOCUMENTS, CAN_DELETE_DOCUMENTS, canAny } from '../../config/capabilities.js';
import { formatCurrency } from '../../utils/currency.js';
import { API_URL } from '../../config/env.js';

const STATUS_TONE = { pending: 'warning', completed: 'success', failed: 'danger', refunded: 'neutral', reversed: 'neutral' };
const STATUS_LIST = ['completed', 'pending', 'refunded'];
const dateFmt = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' });

export default function PaymentsListPage() {
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  const canManage = canAny(roles, CAN_MANAGE_PAYMENTS);
  const canUploadDocs = canAny(roles, CAN_UPLOAD_DOCUMENTS);
  const canDeleteDocs = canAny(roles, CAN_DELETE_DOCUMENTS);

  const [payments, setPayments] = useState([]);
  const [meta, setMeta] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [recordOpen, setRecordOpen] = useState(false);
  const [refundPayment, setRefundPayment] = useState(null);
  const statusCounts = useStatusCounts(paymentsApi.list, STATUS_LIST, [meta.total]);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    paymentsApi.list({ page, pageSize: 20, status: status || undefined })
      .then((res) => { setPayments(res.data); setMeta(res.meta); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [page, status]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Wallet}
        eyebrow="Financial Management"
        title="Payments"
        description="Record and track tenant payments."
        action={canManage && (
          <Button onClick={() => setRecordOpen(true)}>
            <Plus size={16} aria-hidden="true" />
            Record payment
          </Button>
        )}
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={Wallet} label="Total Payments" value={statusCounts?.total ?? '—'} subtext="All payments" tone="brand" />
        <StatCard icon={CheckCircle2} label="Completed" value={statusCounts?.completed ?? '—'} subtext="Successfully processed" tone="success" />
        <StatCard icon={Clock} label="Pending" value={statusCounts?.pending ?? '—'} subtext="Awaiting processing" tone="warning" />
        <StatCard icon={RotateCcw} label="Refunded" value={statusCounts?.refunded ?? '—'} subtext="Reversed" tone="neutral" />
      </div>

      <Card>
        <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <SelectField label="Status" className="sm:w-56" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
            <option value="reversed">Reversed</option>
          </SelectField>
        </CardBody>
      </Card>

      {error && <Alert variant="error">{error}</Alert>}

      <Card>
        {loading ? (
          <LoadingState label="Loading payments…" />
        ) : payments.length === 0 ? (
          <CardBody className="flex flex-col items-center gap-2 py-16 text-center">
            <Wallet size={28} className="text-slate-300 dark:text-slate-700" aria-hidden="true" />
            <p className="text-sm text-slate-500 dark:text-slate-400">No payments found.</p>
          </CardBody>
        ) : (
          <>
            <Table>
              <Thead>
                <Tr>
                  <Th>Amount</Th>
                  <Th>Customer</Th>
                  <Th>For</Th>
                  <Th>Date</Th>
                  <Th>Method</Th>
                  <Th>Reference</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {payments.map((p) => (
                  <Tr key={p.id}>
                    <Td className="font-medium text-slate-900 dark:text-slate-100">{formatCurrency(p.amount)}</Td>
                    <Td>{p.tenant ? `${p.tenant.firstName} ${p.tenant.lastName}` : 'Unknown tenant'}</Td>
                    <Td className="max-w-[14rem]"><span className="block truncate" title={p.deal?.title}>{p.deal ? `${p.deal.kind === 'buy' ? 'Purchase' : p.deal.kind === 'lease' ? 'Lease' : 'Rent'} · ${p.deal.title}` : 'Invoice / rent'}</span></Td>
                    <Td className="whitespace-nowrap">{dateFmt.format(new Date(p.paymentDate))}</Td>
                    <Td className="whitespace-nowrap capitalize">{p.paymentMethod.replace('_', ' ')}</Td>
                    <Td>{p.reference || '—'}</Td>
                    <Td><Badge tone={STATUS_TONE[p.status] ?? 'neutral'}>{p.status}</Badge></Td>
                    <Td>
                      <div className="flex items-center justify-end gap-2">
                        {['completed', 'refunded'].includes(p.status) && (
                          <a
                            href={`${API_URL}/payments/${p.id}/receipt`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                          >
                            <Receipt size={14} aria-hidden="true" />
                            Receipt
                          </a>
                        )}
                        <DocumentsButton
                          entityType="payment"
                          entityId={p.id}
                          canUpload={canUploadDocs}
                          canDelete={canDeleteDocs}
                          title={`Payment of ${formatCurrency(p.amount)} — Documents`}
                        />
                        {hasPermission('payments:refund') && p.status === 'completed' && (
                          <Button variant="danger" size="sm" onClick={() => setRefundPayment(p)}>
                            <RotateCcw size={14} aria-hidden="true" />
                            Refund
                          </Button>
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

      <RecordPaymentModal open={recordOpen} onClose={() => setRecordOpen(false)} onSaved={load} />
      <ConfirmDialog
        open={Boolean(refundPayment)}
        onClose={() => setRefundPayment(null)}
        onConfirm={async () => { await paymentsApi.refund(refundPayment.id); load(); }}
        title="Refund payment?"
        description={refundPayment ? `This refunds ${formatCurrency(refundPayment.amount)} and reverses its effect on the linked invoice, if any.` : ''}
        confirmLabel="Refund"
      />
    </div>
  );
}
