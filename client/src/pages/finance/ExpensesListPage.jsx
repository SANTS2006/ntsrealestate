import { useCallback, useEffect, useState } from 'react';
import { hasPermission } from '../../config/capabilities.js';
import { Plus, Receipt, Check, X, DollarSign, Clock, CheckCircle2, Trash2 } from 'lucide-react';
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
import { ExpenseFormModal } from '../../components/finance/ExpenseFormModal.jsx';
import { expensesApi } from '../../api/expenses.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useStatusCounts } from '../../hooks/useStatusCounts.js';
import { CAN_MANAGE_EXPENSES, CAN_UPLOAD_DOCUMENTS, CAN_DELETE_DOCUMENTS, canAny } from '../../config/capabilities.js';
import { formatCurrency } from '../../utils/currency.js';

const STATUS_TONE = { pending_approval: 'warning', approved: 'brand', rejected: 'danger', paid: 'success' };
const STATUS_LIST = ['pending_approval', 'approved', 'paid'];
const dateFmt = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' });

export default function ExpensesListPage() {
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  const canManage = canAny(roles, CAN_MANAGE_EXPENSES);
  const canUploadDocs = canAny(roles, CAN_UPLOAD_DOCUMENTS);
  const canDeleteDocs = canAny(roles, CAN_DELETE_DOCUMENTS);

  const [expenses, setExpenses] = useState([]);
  const [meta, setMeta] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [approveExpense, setApproveExpense] = useState(null);
  const [rejectExpense, setRejectExpense] = useState(null);
  const [markPaidExpense, setMarkPaidExpense] = useState(null);
  const [deleteExpense, setDeleteExpense] = useState(null);
  const statusCounts = useStatusCounts(expensesApi.list, STATUS_LIST, [meta.total]);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    expensesApi.list({ page, pageSize: 20, status: status || undefined })
      .then((res) => { setExpenses(res.data); setMeta(res.meta); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [page, status]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Receipt}
        eyebrow="Financial Management"
        title="Expenses"
        description="Track and approve property expenses."
        action={canManage && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus size={16} aria-hidden="true" />
            New expense
          </Button>
        )}
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={Receipt} label="Total Expenses" value={statusCounts?.total ?? '—'} subtext="All expenses" tone="brand" />
        <StatCard icon={Clock} label="Pending Approval" value={statusCounts?.pending_approval ?? '—'} subtext="Awaiting review" tone="warning" />
        <StatCard icon={CheckCircle2} label="Approved" value={statusCounts?.approved ?? '—'} subtext="Ready to pay" tone="brand" />
        <StatCard icon={DollarSign} label="Paid" value={statusCounts?.paid ?? '—'} subtext="Settled" tone="success" />
      </div>

      <Card>
        <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <SelectField label="Status" className="sm:w-56" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            <option value="pending_approval">Pending approval</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="paid">Paid</option>
          </SelectField>
        </CardBody>
      </Card>

      {error && <Alert variant="error">{error}</Alert>}

      <Card>
        {loading ? (
          <LoadingState label="Loading expenses…" />
        ) : expenses.length === 0 ? (
          <CardBody className="flex flex-col items-center gap-2 py-16 text-center">
            <Receipt size={28} className="text-slate-300 dark:text-slate-700" aria-hidden="true" />
            <p className="text-sm text-slate-500 dark:text-slate-400">No expenses found.</p>
          </CardBody>
        ) : (
          <>
            <Table>
              <Thead>
                <Tr>
                  <Th>Amount</Th>
                  <Th>Category</Th>
                  <Th>Date</Th>
                  <Th>Description</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {expenses.map((exp) => (
                  <Tr key={exp.id}>
                    <Td className="font-medium text-slate-900 dark:text-slate-100">{formatCurrency(exp.amount)}</Td>
                    <Td>{exp.category?.name ?? 'Uncategorized'}</Td>
                    <Td className="whitespace-nowrap">{dateFmt.format(new Date(exp.expenseDate))}</Td>
                    <Td className="max-w-xs truncate">{exp.description || '—'}</Td>
                    <Td><Badge tone={STATUS_TONE[exp.status] ?? 'neutral'}>{exp.status.replace('_', ' ')}</Badge></Td>
                    <Td>
                      <div className="flex items-center justify-end gap-2">
                        <DocumentsButton
                          entityType="expense"
                          entityId={exp.id}
                          canUpload={canUploadDocs}
                          canDelete={canDeleteDocs}
                          title={`Expense of ${formatCurrency(exp.amount)} — Documents`}
                        />
                        {canManage && (
                          <>
                            {exp.status === 'pending_approval' && hasPermission('expenses:approve') && (
                              <>
                                <Button size="sm" onClick={() => setApproveExpense(exp)}>
                                  <Check size={14} aria-hidden="true" />
                                  Approve
                                </Button>
                                <Button variant="danger" size="sm" onClick={() => setRejectExpense(exp)}>
                                  <X size={14} aria-hidden="true" />
                                  Reject
                                </Button>
                              </>
                            )}
                            {['pending_approval', 'rejected'].includes(exp.status) && hasPermission('expenses:delete') && (
                              <Button variant="danger" size="sm" onClick={() => setDeleteExpense(exp)} aria-label="Delete expense">
                                <Trash2 size={14} aria-hidden="true" />
                                Delete
                              </Button>
                            )}
                            {exp.status === 'approved' && hasPermission('expenses:update') && (
                              <Button size="sm" onClick={() => setMarkPaidExpense(exp)}>
                                <DollarSign size={14} aria-hidden="true" />
                                Mark paid
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

      <ExpenseFormModal open={createOpen} onClose={() => setCreateOpen(false)} onSaved={load} />
      <ConfirmDialog
        open={Boolean(approveExpense)}
        onClose={() => setApproveExpense(null)}
        onConfirm={async () => { await expensesApi.approve(approveExpense.id); load(); }}
        title="Approve expense?"
        description={approveExpense ? `Approve the ${formatCurrency(approveExpense.amount)} expense.` : ''}
        confirmLabel="Approve"
        variant="primary"
      />
      <ConfirmDialog
        open={Boolean(rejectExpense)}
        onClose={() => setRejectExpense(null)}
        onConfirm={async () => { await expensesApi.reject(rejectExpense.id); load(); }}
        title="Reject expense?"
        description={rejectExpense ? `Reject the ${formatCurrency(rejectExpense.amount)} expense.` : ''}
        confirmLabel="Reject"
      />
      <ConfirmDialog
        open={Boolean(deleteExpense)}
        onClose={() => setDeleteExpense(null)}
        onConfirm={async () => { await expensesApi.remove(deleteExpense.id); load(); }}
        title="Delete expense?"
        description={deleteExpense ? `Permanently delete the ${formatCurrency(deleteExpense.amount)} expense. This cannot be undone.` : ''}
        confirmLabel="Delete"
      />
      <ConfirmDialog
        open={Boolean(markPaidExpense)}
        onClose={() => setMarkPaidExpense(null)}
        onConfirm={async () => { await expensesApi.markPaid(markPaidExpense.id); load(); }}
        title="Mark expense as paid?"
        description={markPaidExpense ? `Mark the ${formatCurrency(markPaidExpense.amount)} expense as paid.` : ''}
        confirmLabel="Mark paid"
        variant="primary"
      />
    </div>
  );
}
