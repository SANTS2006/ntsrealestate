import { useCallback, useEffect, useState } from 'react';
import { hasPermission } from '../../config/capabilities.js';
import { Plus, Receipt, Send, Ban, Pencil, Wallet, CheckCircle2, AlertTriangle, Trash2 } from 'lucide-react';
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
import { CreateInvoiceModal } from '../../components/finance/CreateInvoiceModal.jsx';
import { EditInvoiceModal } from '../../components/finance/EditInvoiceModal.jsx';
import { VoidInvoiceModal } from '../../components/finance/VoidInvoiceModal.jsx';
import { RecordPaymentModal } from '../../components/finance/RecordPaymentModal.jsx';
import { invoicesApi } from '../../api/invoices.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useStatusCounts } from '../../hooks/useStatusCounts.js';
import { CAN_MANAGE_INVOICES, CAN_UPLOAD_DOCUMENTS, CAN_DELETE_DOCUMENTS, canAny } from '../../config/capabilities.js';
import { formatCurrency } from '../../utils/currency.js';

const STATUS_TONE = { draft: 'neutral', sent: 'brand', partially_paid: 'warning', paid: 'success', overdue: 'danger', void: 'neutral' };
const STATUS_LIST = ['paid', 'overdue', 'draft'];
const dateFmt = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' });

export default function InvoicesListPage() {
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  const canManage = canAny(roles, CAN_MANAGE_INVOICES);
  const canUploadDocs = canAny(roles, CAN_UPLOAD_DOCUMENTS);
  const canDeleteDocs = canAny(roles, CAN_DELETE_DOCUMENTS);

  const [invoices, setInvoices] = useState([]);
  const [meta, setMeta] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [editInvoice, setEditInvoice] = useState(null);
  const [voidInvoiceState, setVoidInvoiceState] = useState(null);
  const [payInvoice, setPayInvoice] = useState(null);
  const [sendInvoiceState, setSendInvoiceState] = useState(null);
  const [deleteInvoice, setDeleteInvoice] = useState(null);
  const statusCounts = useStatusCounts(invoicesApi.list, STATUS_LIST, [meta.total]);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    invoicesApi.list({ page, pageSize: 20, status: status || undefined })
      .then((res) => { setInvoices(res.data); setMeta(res.meta); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [page, status]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Receipt}
        eyebrow="Financial Management"
        title="Invoices"
        description="Bill tenants and track outstanding balances."
        action={canManage && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus size={16} aria-hidden="true" />
            New invoice
          </Button>
        )}
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={Receipt} label="Total Invoices" value={statusCounts?.total ?? '—'} subtext="All invoices" tone="brand" />
        <StatCard icon={CheckCircle2} label="Paid" value={statusCounts?.paid ?? '—'} subtext="Fully paid" tone="success" />
        <StatCard icon={AlertTriangle} label="Overdue" value={statusCounts?.overdue ?? '—'} subtext="Past due date" tone="danger" />
        <StatCard icon={Pencil} label="Draft" value={statusCounts?.draft ?? '—'} subtext="Not yet sent" tone="neutral" />
      </div>

      <Card>
        <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <SelectField label="Status" className="sm:w-56" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="partially_paid">Partially paid</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
            <option value="void">Void</option>
          </SelectField>
        </CardBody>
      </Card>

      {error && <Alert variant="error">{error}</Alert>}

      <Card>
        {loading ? (
          <LoadingState label="Loading invoices…" />
        ) : invoices.length === 0 ? (
          <CardBody className="flex flex-col items-center gap-2 py-16 text-center">
            <Receipt size={28} className="text-slate-300 dark:text-slate-700" aria-hidden="true" />
            <p className="text-sm text-slate-500 dark:text-slate-400">No invoices found.</p>
          </CardBody>
        ) : (
          <>
            <Table>
              <Thead>
                <Tr>
                  <Th>Invoice #</Th>
                  <Th>Tenant</Th>
                  <Th>Due date</Th>
                  <Th>Total</Th>
                  <Th>Balance</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {invoices.map((inv) => (
                  <Tr key={inv.id}>
                    <Td className="font-medium text-slate-900 dark:text-slate-100">{inv.invoiceNumber}</Td>
                    <Td>{inv.tenant ? `${inv.tenant.firstName} ${inv.tenant.lastName}` : 'Unknown tenant'}</Td>
                    <Td className="whitespace-nowrap">{dateFmt.format(new Date(inv.dueDate))}</Td>
                    <Td className="whitespace-nowrap">{formatCurrency(inv.total)}</Td>
                    <Td className="whitespace-nowrap">
                      {Number(inv.balance) > 0 ? (
                        <span className="font-medium text-amber-600 dark:text-amber-400">{formatCurrency(inv.balance)}</span>
                      ) : (
                        <span className="text-slate-400">{formatCurrency(0)}</span>
                      )}
                    </Td>
                    <Td><Badge tone={STATUS_TONE[inv.status] ?? 'neutral'}>{inv.status.replace('_', ' ')}</Badge></Td>
                    <Td>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <DocumentsButton
                          entityType="invoice"
                          entityId={inv.id}
                          canUpload={canUploadDocs}
                          canDelete={canDeleteDocs}
                          title={`Invoice ${inv.invoiceNumber} — Documents`}
                        />
                        {canManage && (
                          <>
                            {inv.status === 'draft' && hasPermission('invoices:delete') && (
                              <Button variant="danger" size="sm" onClick={() => setDeleteInvoice(inv)} aria-label="Delete invoice">
                                <Trash2 size={14} aria-hidden="true" />
                                Delete
                              </Button>
                            )}
                            {inv.status === 'draft' && hasPermission('invoices:update') && (
                              <>
                                <Button variant="secondary" size="sm" onClick={() => setEditInvoice(inv)}>
                                  <Pencil size={14} aria-hidden="true" />
                                  Edit
                                </Button>
                                <Button size="sm" onClick={() => setSendInvoiceState(inv)}>
                                  <Send size={14} aria-hidden="true" />
                                  Send
                                </Button>
                              </>
                            )}
                            {['sent', 'partially_paid', 'overdue'].includes(inv.status) && Number(inv.balance) > 0 && hasPermission('payments:create') && (
                              <Button size="sm" onClick={() => setPayInvoice(inv)}>
                                <Wallet size={14} aria-hidden="true" />
                                Record payment
                              </Button>
                            )}
                            {inv.status !== 'void' && Number(inv.amountPaid) === 0 && hasPermission('invoices:void') && (
                              <Button variant="danger" size="sm" onClick={() => setVoidInvoiceState(inv)}>
                                <Ban size={14} aria-hidden="true" />
                                Void
                              </Button>
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

      <CreateInvoiceModal open={createOpen} onClose={() => setCreateOpen(false)} onSaved={load} />
      <EditInvoiceModal open={Boolean(editInvoice)} onClose={() => setEditInvoice(null)} onSaved={load} invoice={editInvoice} />
      <VoidInvoiceModal open={Boolean(voidInvoiceState)} onClose={() => setVoidInvoiceState(null)} onSaved={load} invoice={voidInvoiceState} />
      <RecordPaymentModal open={Boolean(payInvoice)} onClose={() => setPayInvoice(null)} onSaved={load} presetInvoice={payInvoice} />
      <ConfirmDialog
        open={Boolean(deleteInvoice)}
        onClose={() => setDeleteInvoice(null)}
        onConfirm={async () => { await invoicesApi.remove(deleteInvoice.id); load(); }}
        title="Delete draft invoice?"
        description={deleteInvoice ? `Permanently delete draft invoice ${deleteInvoice.invoiceNumber}. This cannot be undone.` : ''}
        confirmLabel="Delete"
      />
      <ConfirmDialog
        open={Boolean(sendInvoiceState)}
        onClose={() => setSendInvoiceState(null)}
        onConfirm={async () => { await invoicesApi.send(sendInvoiceState.id); load(); }}
        title="Send invoice?"
        description={sendInvoiceState ? `This marks ${sendInvoiceState.invoiceNumber} as sent to the tenant.` : ''}
        confirmLabel="Send"
        variant="primary"
      />
    </div>
  );
}
