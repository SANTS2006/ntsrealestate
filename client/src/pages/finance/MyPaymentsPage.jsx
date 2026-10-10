import { useEffect, useState } from 'react';
import { Wallet, Receipt } from 'lucide-react';
import { Card, CardBody } from '../../components/ui/Card.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { LoadingState } from '../../components/ui/Spinner.jsx';
import { paymentsApi } from '../../api/payments.js';
import { formatCurrency } from '../../utils/currency.js';
import { API_URL } from '../../config/env.js';

const STATUS_TONE = { pending: 'warning', completed: 'success', failed: 'danger', refunded: 'neutral', reversed: 'neutral' };
const dateFmt = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' });

export default function MyPaymentsPage() {
  const [payments, setPayments] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    paymentsApi.list({ pageSize: 50 })
      .then((res) => setPayments(res.data))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">My payments</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Your payment history.</p>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {!payments && !error && <LoadingState label="Loading your payments…" />}

      <Card>
        {payments && payments.length === 0 ? (
          <CardBody className="flex flex-col items-center gap-2 py-16 text-center">
            <Wallet size={28} className="text-slate-300 dark:text-slate-700" aria-hidden="true" />
            <p className="text-sm text-slate-500 dark:text-slate-400">No payments on file yet.</p>
          </CardBody>
        ) : (
          payments && (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-4 px-6 py-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-900 dark:text-slate-100">{formatCurrency(p.amount)}</p>
                      <Badge tone={STATUS_TONE[p.status] ?? 'neutral'}>{p.status}</Badge>
                    </div>
                    {p.deal && <p className="mt-0.5 truncate text-sm text-slate-700 dark:text-slate-300">{p.deal.kind === 'buy' ? 'Purchase' : p.deal.kind === 'lease' ? 'Lease' : 'Rent'} · {p.deal.title}</p>}
                    <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                      {dateFmt.format(new Date(p.paymentDate))} · {p.paymentMethod.replace('_', ' ')}
                      {p.reference && <> · Ref: {p.reference}</>}
                    </p>
                  </div>
                  {['completed', 'refunded'].includes(p.status) && (
                    <a
                      href={`${API_URL}/payments/${p.id}/receipt`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <Receipt size={14} aria-hidden="true" />
                      Receipt
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )
        )}
      </Card>
    </div>
  );
}
