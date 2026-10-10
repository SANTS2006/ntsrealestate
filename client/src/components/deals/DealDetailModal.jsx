import { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal.jsx';
import { Badge } from '../ui/Badge.jsx';
import { Alert } from '../ui/Alert.jsx';
import { Spinner } from '../ui/Spinner.jsx';
import { InfoGrid } from '../ui/Detail.jsx';
import { dealsApi } from '../../api/deals.js';
import { DEAL_KINDS, DEAL_STATUS } from '../../config/dealLabels.js';
import { formatCurrency } from '../../utils/currency.js';

const dateFmt = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' });

// One deal: what it is for, the customer, the price and every payment so far.
export function DealDetailModal({ dealId, onClose }) {
  const [deal, setDeal] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setDeal(null);
    setError(null);
    if (!dealId) return;
    dealsApi.get(dealId).then((res) => setDeal(res.data)).catch((err) => setError(err.message));
  }, [dealId]);

  return (
    <Modal open={Boolean(dealId)} onClose={onClose} title={deal?.subject.title ?? 'Deal'} size="lg">
      {error && <Alert variant="error">{error}</Alert>}
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
