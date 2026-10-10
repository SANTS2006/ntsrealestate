import { useCallback, useEffect, useState } from 'react';
import { Handshake, Check, Flag, XCircle, Wallet, Eye } from 'lucide-react';
import { Card, CardBody } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { SelectField } from '../../components/ui/Input.jsx';
import { LoadingState } from '../../components/ui/Spinner.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.jsx';
import { Table, Thead, Tbody, Tr, Th, Td } from '../../components/ui/Table.jsx';
import { DealPaymentModal } from '../../components/deals/DealPaymentModal.jsx';
import { DealDetailModal } from '../../components/deals/DealDetailModal.jsx';
import { dealsApi } from '../../api/deals.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { hasPermission } from '../../config/capabilities.js';
import { DEAL_KINDS, DEAL_STATUS } from '../../config/dealLabels.js';
import { formatCurrency } from '../../utils/currency.js';

// Everything people are renting, buying or leasing: houses and lands. Staff
// (administrators, and the owners and agents it concerns) manage them here;
// a customer sees their own under "My deals".
export default function DealsPage({ mine = false }) {
  useDocumentTitle(mine ? 'My Deals' : 'Sales & Leases');
  const canUpdate = !mine && hasPermission('deals:update');
  const canPay = !mine && hasPermission('payments:create');

  const [deals, setDeals] = useState([]);
  const [meta, setMeta] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [kind, setKind] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [payDeal, setPayDeal] = useState(null);
  const [viewDeal, setViewDeal] = useState(null);
  const [confirm, setConfirm] = useState(null); // { deal, status }

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    dealsApi.list({ page, pageSize: 20, kind: kind || undefined, status: status || undefined })
      .then((res) => { setDeals(res.data); setMeta(res.meta); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [page, kind, status]);

  useEffect(() => { load(); }, [load]);

  const verbs = {
    approved: { title: 'Approve this request?', label: 'Approve', text: 'The customer is told it was approved. For a lease, the lease becomes active.' },
    completed: { title: 'Mark as completed?', label: 'Complete', text: 'The deal is finished. A sold house or land stops being listed.' },
    cancelled: { title: 'Cancel this request?', label: 'Cancel request', text: 'The house or land is made available again and the customer is told.' },
  };

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader
        icon={Handshake}
        eyebrow={mine ? 'My account' : 'Sales'}
        title={mine ? 'My deals' : 'Sales & leases'}
        description={mine ? 'Everything you are renting, buying or leasing, and what you have paid.' : 'Rentals, purchases and leases of houses, and land purchases — with payments.'}
      />

      <Card>
        <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <SelectField label="Kind" className="sm:w-48" value={kind} onChange={(e) => { setKind(e.target.value); setPage(1); }}>
            <option value="">All kinds</option>
            <option value="rent">Rent</option>
            <option value="buy">Purchase</option>
            <option value="lease">Lease</option>
          </SelectField>
          <SelectField label="Status" className="sm:w-48" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            {Object.entries(DEAL_STATUS).map(([value, s]) => <option key={value} value={value}>{s.label}</option>)}
          </SelectField>
        </CardBody>
      </Card>

      {error && <Alert variant="error">{error}</Alert>}

      <Card>
        {loading ? (
          <LoadingState label="Loading deals…" />
        ) : deals.length === 0 ? (
          <CardBody className="flex flex-col items-center gap-2 py-16 text-center">
            <Handshake size={28} className="text-slate-300 dark:text-slate-700" aria-hidden="true" />
            <p className="text-sm text-slate-500 dark:text-slate-400">{mine ? 'You have no rentals, purchases or leases yet.' : 'No deals found.'}</p>
          </CardBody>
        ) : (
          <>
            <Table>
              <Thead>
                <Tr>
                  {!mine && <Th>Customer</Th>}
                  <Th>For</Th>
                  <Th>Kind</Th>
                  <Th>Price</Th>
                  <Th>Paid</Th>
                  <Th>Balance</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {deals.map((d) => {
                  const open = d.status === 'pending' || d.status === 'approved';
                  return (
                    <Tr key={d.id}>
                      {!mine && <Td className="font-medium text-slate-900 dark:text-slate-100">{d.tenant?.name ?? '—'}</Td>}
                      <Td className="max-w-[16rem]"><span className="block truncate" title={d.subject.title}>{d.subject.title}</span></Td>
                      <Td><Badge tone={DEAL_KINDS[d.kind].tone}>{DEAL_KINDS[d.kind].label}</Badge></Td>
                      <Td className="whitespace-nowrap">
                        {formatCurrency(d.price)}
                        <span className="text-xs text-slate-400">{d.kind === 'rent' ? ' /mo' : d.kind === 'lease' ? ' /yr' : ''}</span>
                      </Td>
                      <Td className="whitespace-nowrap">{formatCurrency(d.paid)}</Td>
                      <Td className="whitespace-nowrap">{d.kind === 'rent' ? '—' : formatCurrency(d.balance)}</Td>
                      <Td><Badge tone={DEAL_STATUS[d.status].tone}>{DEAL_STATUS[d.status].label}</Badge></Td>
                      <Td>
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <Button variant="secondary" size="sm" onClick={() => setViewDeal(d)}><Eye size={14} aria-hidden="true" />View</Button>
                          {canPay && open && <Button variant="secondary" size="sm" onClick={() => setPayDeal(d)}><Wallet size={14} aria-hidden="true" />Record payment</Button>}
                          {canUpdate && d.status === 'pending' && <Button size="sm" onClick={() => setConfirm({ deal: d, status: 'approved' })}><Check size={14} aria-hidden="true" />Approve</Button>}
                          {canUpdate && d.status === 'approved' && <Button size="sm" onClick={() => setConfirm({ deal: d, status: 'completed' })}><Flag size={14} aria-hidden="true" />Complete</Button>}
                          {canUpdate && open && <Button variant="danger" size="sm" onClick={() => setConfirm({ deal: d, status: 'cancelled' })}><XCircle size={14} aria-hidden="true" />Cancel</Button>}
                        </div>
                      </Td>
                    </Tr>
                  );
                })}
              </Tbody>
            </Table>
            <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} pageSize={meta.pageSize} onPageChange={setPage} />
          </>
        )}
      </Card>

      <DealDetailModal dealId={viewDeal?.id} onClose={() => setViewDeal(null)} />
      <DealPaymentModal deal={payDeal} onClose={() => setPayDeal(null)} onSaved={load} />
      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={async () => { await dealsApi.setStatus(confirm.deal.id, confirm.status); load(); }}
        title={confirm ? verbs[confirm.status].title : ''}
        description={confirm ? `${confirm.deal.subject.title}${confirm.deal.tenant ? ` — ${confirm.deal.tenant.name}` : ''}. ${verbs[confirm.status].text}` : ''}
        confirmLabel={confirm ? verbs[confirm.status].label : 'Confirm'}
      />
    </div>
  );
}
