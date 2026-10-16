import { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal.jsx';
import { Badge } from '../ui/Badge.jsx';
import { Alert } from '../ui/Alert.jsx';
import { Spinner } from '../ui/Spinner.jsx';
import { Button } from '../ui/Button.jsx';
import { InfoGrid } from '../ui/Detail.jsx';
import { dealsApi } from '../../api/deals.js';
import { DEAL_KINDS, DEAL_STATUS, FREQUENCY, INSTALLMENT_STATUS, END_REASONS } from '../../config/dealLabels.js';
import { formatCurrency } from '../../utils/currency.js';

const dateFmt = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' });

// One deal: what it is for, the customer, the price and every payment so far.
export function DealDetailModal({ dealId, onClose, canRequestRenewal = false, onChanged }) {
  const [deal, setDeal] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => dealsApi.get(dealId).then((res) => setDeal(res.data)).catch((err) => setError(err.message));
  useEffect(() => {
    setDeal(null);
    setError(null);
    if (!dealId) return;
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId]);

  const askToRenew = async () => {
    setBusy(true); setError(null);
    try { const res = await dealsApi.requestRenewal(dealId); setDeal(res.data); onChanged?.(); } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <Modal open={Boolean(dealId)} onClose={onClose} title={deal?.subject.title ?? 'Deal'} size="lg">
      {error && <Alert variant="error" className="mb-3">{error}</Alert>}
      {!deal && !error && <div className="py-10"><Spinner label="Loading…" /></div>}
      {deal && (
        <div className="flex min-w-0 flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={DEAL_KINDS[deal.kind].tone}>{DEAL_KINDS[deal.kind].label}</Badge>
            <Badge tone={DEAL_STATUS[deal.status].tone}>{DEAL_STATUS[deal.status].label}</Badge>
            <span className="text-xs text-slate-400">Requested {dateFmt.format(new Date(deal.createdAt))}</span>
          </div>
          <InfoGrid cols={3} items={[
            deal.tenant ? { label: 'Customer', value: deal.tenant.name } : null,
            deal.tenant?.email ? { label: 'Email', value: deal.tenant.email } : null,
            deal.tenant?.phone ? { label: 'Phone', value: deal.tenant.phone } : null,
            { label: deal.kind === 'rent' ? 'Rent per month' : deal.kind === 'lease' ? 'Lease price per year' : 'Price', value: formatCurrency(deal.price) },
            deal.termMonths ? { label: 'Lease term', value: `${deal.termMonths} months` } : null,
            { label: 'Paid so far', value: formatCurrency(deal.paid) },
            deal.kind !== 'rent' ? { label: 'Still to pay', value: formatCurrency(deal.balance) } : null,
          ]} />
          {deal.endedAt && (
            <Alert variant="info">
              Ended {dateFmt.format(new Date(deal.endedAt))} — {END_REASONS.find((r) => r.value === deal.endReason)?.label ?? deal.endReason}.{deal.endNote ? ` ${deal.endNote}` : ''}
            </Alert>
          )}
          {deal.plan && (
            <div className="flex min-w-0 flex-col gap-3">
              <InfoGrid cols={3} items={[
                deal.plan.frequency ? { label: 'Pays', value: `${FREQUENCY[deal.plan.frequency]?.label ?? deal.plan.frequency} · ${formatCurrency(deal.plan.installmentAmount)}` } : null,
                deal.plan.startDate ? { label: 'Starts', value: dateFmt.format(new Date(deal.plan.startDate)) } : null,
                deal.plan.endDate ? { label: 'Ends', value: dateFmt.format(new Date(deal.plan.endDate)) } : null,
                deal.plan.securityDeposit ? { label: 'Security deposit', value: formatCurrency(deal.plan.securityDeposit) } : null,
                deal.plan.next ? { label: 'Next payment', value: `${formatCurrency(deal.plan.next.amountDue)} on ${dateFmt.format(new Date(deal.plan.next.dueDate))}` } : null,
                deal.plan.renewalCount ? { label: 'Renewed', value: `${deal.plan.renewalCount} time${deal.plan.renewalCount === 1 ? '' : 's'}` } : null,
              ].filter(Boolean)} />
              {deal.plan.overdueCount > 0 && <Alert variant="error">{deal.plan.overdueCount} payment{deal.plan.overdueCount === 1 ? '' : 's'} overdue — {formatCurrency(deal.plan.overdueAmount)}.</Alert>}
              {canRequestRenewal && deal.status === 'approved' && (
                deal.plan.renewalRequestedAt
                  ? <Alert variant="success">You asked to renew. Your agent will confirm.</Alert>
                  : <div><Button variant="secondary" size="sm" onClick={askToRenew} loading={busy}>Ask to renew</Button></div>
              )}
              <div>
                <p className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">Payment plan</p>
                <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                  {deal.installments.map((i) => (
                    <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                      <span className="text-slate-500 dark:text-slate-400">#{i.sequence} · due {dateFmt.format(new Date(i.dueDate))}</span>
                      <span className="font-medium text-slate-900 dark:text-slate-100">{formatCurrency(i.amount)}{i.paidAmount > 0 && i.status !== 'paid' ? <span className="font-normal text-slate-500"> ({formatCurrency(i.paidAmount)} paid)</span> : null}</span>
                      <Badge tone={INSTALLMENT_STATUS[i.status]?.tone ?? 'neutral'}>{INSTALLMENT_STATUS[i.status]?.label ?? i.status}</Badge>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          <div>
            <p className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">Payments</p>
            {deal.payments.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">No payments recorded yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                {deal.payments.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                    <span className="font-medium text-slate-900 dark:text-slate-100">{formatCurrency(p.amount)}</span>
                    <span className="min-w-0 truncate text-slate-500 dark:text-slate-400">
                      {dateFmt.format(new Date(p.paymentDate))} · {p.paymentMethod.replace('_', ' ')}{p.reference ? ` · ${p.reference}` : ''}
                    </span>
                    <Badge tone={p.status === 'completed' ? 'success' : 'neutral'}>{p.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
