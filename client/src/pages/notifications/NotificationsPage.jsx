import { useCallback, useEffect, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { NotificationDetailModal } from '../../components/notifications/NotificationDetailModal.jsx';
import { Card, CardBody } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { LoadingState } from '../../components/ui/Spinner.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { notificationsApi } from '../../api/notifications.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useNotifications } from '../../contexts/NotificationsContext.jsx';
import { useSearchParams } from 'react-router-dom';
import { CAN_VIEW_ALL_NOTIFICATIONS, canAny } from '../../config/capabilities.js';

const dateTimeFmt = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' });

const TYPE_LABEL = {
  payment_received: 'Payment',
  maintenance_assigned: 'Maintenance',
  maintenance_completed: 'Maintenance',
  inspection_scheduled: 'Inspection',
  lease_activated: 'Lease',
  invoice_sent: 'Invoice',
  audit_remark_created: 'Audit',
  tenant_message: 'Message',
  referral_used: 'Referral',
  referral_bonus_approved: 'Referral',
  referral_bonus_paid: 'Referral',
  rent_due: 'Rent',
  rent_overdue: 'Rent',
  lease_expiring: 'Lease',
  document_uploaded: 'Document',
  user_invited: 'Account',
  system: 'System',
};

export default function NotificationsPage() {
  const { user } = useAuth();
  const canViewAll = canAny(user?.roles ?? [], CAN_VIEW_ALL_NOTIFICATIONS);
  const [notifications, setNotifications] = useState([]);
  const [meta, setMeta] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [viewAll, setViewAll] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [markingAll, setMarkingAll] = useState(false);
  const live = useNotifications();
  const [searchParams, setSearchParams] = useSearchParams();
  const [openId, setOpenId] = useState(searchParams.get('open'));
  const [desktopAlerts, setDesktopAlerts] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported');

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    notificationsApi.list({ page, pageSize: 20, unreadOnly: unreadOnly || undefined, all: (canViewAll && viewAll) || undefined })
      .then((res) => { setNotifications(res.data); setMeta(res.meta); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [page, unreadOnly, viewAll, canViewAll]);

  useEffect(() => { load(); }, [load]);

  // A new notification arrives while this page is open: it appears at once.
  useEffect(() => live?.subscribe(() => { if (page === 1) load(); }), [live, page, load]);
  // Opened from a toast or a desktop alert: show that notification, then tidy the address.
  useEffect(() => {
    if (searchParams.get('open')) { setOpenId(searchParams.get('open')); setSearchParams({}, { replace: true }); }
  }, [searchParams, setSearchParams]);

  const enableDesktopAlerts = async () => {
    try { setDesktopAlerts(await Notification.requestPermission()); } catch { /* unsupported */ }
  };

  const unreadCount = meta.unreadCount ?? 0;
  const effectiveViewAll = canViewAll && viewAll;

  const markOneRead = async (notification) => {
    // The org-wide feed shows every user's notifications, not just this
    // admin's own — there is nothing for them to mark read here (the
    // server's markRead is self-scoped by userId regardless).
    if (effectiveViewAll || notification.readAt) return;
    try {
      const updated = await notificationsApi.markRead(notification.id);
      setNotifications((prev) => prev.map((n) => (n.id === notification.id ? updated.data : n)));
      live?.refreshCount();
    } catch {
      // Marking read is a soft, non-critical action — a failed request just
      // leaves the item unread; the user can retry by clicking again.
    }
  };

  const markAllRead = async () => {
    setMarkingAll(true);
    try {
      await notificationsApi.markAllRead();
      live?.setUnreadCount(0);
      load();
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Notifications</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Updates on payments, maintenance, and account activity.</p>
        </div>
        {!effectiveViewAll && unreadCount > 0 && (
          <Button variant="secondary" onClick={markAllRead} loading={markingAll}>
            <CheckCheck size={16} aria-hidden="true" />
            Mark all as read
          </Button>
        )}
      </div>

      <Card>
        <CardBody className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(e) => { setUnreadOnly(e.target.checked); setPage(1); }}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-slate-700"
            />
            Unread only
          </label>
          {desktopAlerts === 'default' && (
            <button type="button" onClick={enableDesktopAlerts} className="ml-auto text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400">Turn on desktop alerts</button>
          )}
          {canViewAll && (
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={viewAll}
                onChange={(e) => { setViewAll(e.target.checked); setPage(1); }}
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-slate-700"
              />
              All notifications (org-wide)
            </label>
          )}
        </CardBody>
      </Card>

      {error && <Alert variant="error">{error}</Alert>}

      <Card>
        {loading ? (
          <LoadingState label="Loading notifications…" />
        ) : notifications.length === 0 ? (
          <CardBody className="flex flex-col items-center gap-2 py-16 text-center">
            <Bell size={28} className="text-slate-300 dark:text-slate-700" aria-hidden="true" />
            <p className="text-sm text-slate-500 dark:text-slate-400">{unreadOnly ? 'No unread notifications.' : 'No notifications yet.'}</p>
          </CardBody>
        ) : (
          <>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {notifications.map((n) => (
                <li
                  key={n.id}
                  onClick={() => { markOneRead(n); setOpenId(n.id); }}
                  className={`flex items-start gap-3 px-4 py-4 sm:px-6 ${!effectiveViewAll && !n.readAt ? 'cursor-pointer bg-brand-50/50 hover:bg-brand-50 dark:bg-brand-950/20 dark:hover:bg-brand-950/30' : 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40'}`}
                >
                  {!n.readAt && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600" aria-hidden="true" />}
                  <div className={`min-w-0 flex-1 ${n.readAt ? 'pl-5' : ''}`}>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-900 dark:text-slate-100">{n.title}</p>
                      <span className="text-xs text-slate-400">{TYPE_LABEL[n.type] ?? n.type}</span>
                      {effectiveViewAll && n.recipient && (
                        <span className="truncate text-xs text-slate-400">→ {n.recipient.firstName} {n.recipient.lastName}</span>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">{n.message}</p>
                    <p className="mt-1 text-xs text-slate-400">{dateTimeFmt.format(new Date(n.createdAt))}</p>
                  </div>
                </li>
              ))}
            </ul>
            <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} pageSize={meta.pageSize} onPageChange={setPage} />
          </>
        )}
      </Card>
      <NotificationDetailModal id={openId} onClose={() => { setOpenId(null); load(); }} typeLabel={TYPE_LABEL} />
    </div>
  );
}
