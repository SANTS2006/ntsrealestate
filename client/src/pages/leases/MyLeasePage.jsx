import { useEffect, useState } from 'react';
import { FileText } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../../components/ui/Card.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { LoadingState } from '../../components/ui/Spinner.jsx';
import { leasesApi } from '../../api/leases.js';
import { formatCurrency } from '../../utils/currency.js';

const STATUS_TONE = { draft: 'neutral', active: 'success', expiring_soon: 'warning', expired: 'neutral', terminated: 'danger', renewed: 'brand' };
const dateFmt = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' });

export default function MyLeasePage() {
  const [leases, setLeases] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    leasesApi.list({ pageSize: 20 })
      .then((res) => setLeases(res.data))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">My lease</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Your current and past lease agreements.</p>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {!leases && !error && <LoadingState label="Loading your lease…" />}

      {leases && leases.length === 0 && (
        <Card>
          <CardBody className="flex flex-col items-center gap-2 py-16 text-center">
            <FileText size={28} className="text-slate-300 dark:text-slate-700" aria-hidden="true" />
            <p className="text-sm text-slate-500 dark:text-slate-400">No lease is on file for your account yet.</p>
          </CardBody>
        </Card>
      )}

      {leases?.map((lease) => (
        <Card key={lease.id}>
          <CardHeader className="flex items-center justify-between">
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{lease.unit?.title ?? 'Your lease'}</h2>
              {lease.terms?.kind === 'lease' && <p className="text-xs text-slate-500 dark:text-slate-400">Lease · {lease.terms.termMonths} months · {formatCurrency(lease.terms.leasePricePerYear)} per year</p>}
            </div>
            <Badge tone={STATUS_TONE[lease.status] ?? 'neutral'}>{lease.status.replace('_', ' ')}</Badge>
          </CardHeader>
          <CardBody className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Start date</dt>
              <dd className="text-slate-900 dark:text-slate-100">{dateFmt.format(new Date(lease.startDate))}</dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">End date</dt>
              <dd className="text-slate-900 dark:text-slate-100">{dateFmt.format(new Date(lease.endDate))}</dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Monthly rent</dt>
              <dd className="text-slate-900 dark:text-slate-100">{formatCurrency(lease.monthlyRent)}</dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Security deposit</dt>
              <dd className="text-slate-900 dark:text-slate-100">{lease.securityDeposit != null ? formatCurrency(lease.securityDeposit) : '—'}</dd>
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
