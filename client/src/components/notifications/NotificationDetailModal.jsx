import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Modal } from '../ui/Modal.jsx';
import { Badge } from '../ui/Badge.jsx';
import { Button } from '../ui/Button.jsx';
import { LoadingState } from '../ui/Spinner.jsx';
import { Alert } from '../ui/Alert.jsx';
import { notificationsApi } from '../../api/notifications.js';

const dateTimeFmt = new Intl.DateTimeFormat('en-US', { dateStyle: 'full', timeStyle: 'short' });

// Where each kind of notification leads.
const RELATED = {
  payment_received: ['/payments', 'Open payments'],
  maintenance_assigned: ['/maintenance', 'Open maintenance'],
  maintenance_completed: ['/maintenance', 'Open maintenance'],
  inspection_scheduled: ['/inspections', 'Open inspections'],
  lease_activated: ['/leases', 'Open leases'],
  invoice_sent: ['/invoices', 'Open invoices'],
  tenant_message: ['/tenant-messages', 'Open tenant messages'],
  referral_used: ['/referrals', 'Open referrals'],
  referral_bonus_approved: ['/referrals', 'Open referrals'],
  referral_bonus_paid: ['/referrals', 'Open referrals'],
  rent_due: ['/invoices', 'Open invoices'],
  rent_overdue: ['/invoices', 'Open invoices'],
  lease_expiring: ['/leases', 'Open leases'],
  document_uploaded: ['/documents', 'Open documents'],
};

// The full notification, opened by clicking one in the list.
export function NotificationDetailModal({ id, onClose, typeLabel = {} }) {
  const [n, setN] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) return undefined;
    let cancelled = false;
    setN(null);
    setError(null);
    notificationsApi.get(id)
      .then((res) => { if (!cancelled) setN(res.data); })
      .catch((err) => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [id]);

  const related = n && RELATED[n.type];

  return (
    <Modal open={Boolean(id)} onClose={onClose} title="Notification" size="md">
      {error && <Alert variant="error">{error}</Alert>}
      {!n && !error && <LoadingState label="Loading…" />}
      {n && (
        <div className="flex min-w-0 flex-col gap-4">
          <div>
            <Badge tone="brand">{typeLabel[n.type] ?? n.type}</Badge>
            <h3 className="mt-2 break-words text-lg font-semibold text-slate-900 dark:text-slate-100">{n.title}</h3>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700 dark:text-slate-200">{n.message}</p>
          </div>
          <dl className="grid grid-cols-1 gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2 dark:bg-slate-800/50">
            <div><dt className="text-xs uppercase tracking-wide text-slate-400">Received</dt><dd className="mt-0.5 text-slate-800 dark:text-slate-200">{dateTimeFmt.format(new Date(n.createdAt))}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-slate-400">Status</dt><dd className="mt-0.5 text-slate-800 dark:text-slate-200">{n.readAt ? `Read ${dateTimeFmt.format(new Date(n.readAt))}` : 'Unread'}</dd></div>
            <div className="min-w-0 sm:col-span-2"><dt className="text-xs uppercase tracking-wide text-slate-400">Sent to</dt><dd className="mt-0.5 truncate text-slate-800 dark:text-slate-200">{n.recipient.firstName} {n.recipient.lastName} · {n.recipient.email}</dd></div>
          </dl>
          <div className="flex flex-wrap justify-end gap-2">
            {related && <Link to={related[0]} onClick={onClose}><Button>{related[1]}</Button></Link>}
            <Button variant="secondary" onClick={onClose}>Close</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
