import { useEffect, useState } from 'react';
import { Wrench, Mail } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { Card, CardBody } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Field, TextareaField } from '../../components/ui/Input.jsx';
import { LoadingState } from '../../components/ui/Spinner.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { platformAdminApi } from '../../api/platformAdmin.js';
import { MAINTENANCE_GROUPS } from '../../config/maintenancePages.js';

const dateTimeFmt = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' });
// <input type="datetime-local"> wants local time without a zone.
const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// Turn maintenance mode on or off for the whole platform: the message people
// see, where it shows, and whether everyone is emailed.
export default function PlatformAdminMaintenancePage() {
  useDocumentTitle('Maintenance — Platform Admin');
  const [state, setState] = useState(null);
  const [message, setMessage] = useState('');
  const [scope, setScope] = useState('all');
  const [pages, setPages] = useState([]);
  const [endsAt, setEndsAt] = useState('');
  const [notify, setNotify] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  const apply = (m) => {
    setState(m);
    setMessage(m.message ?? '');
    setScope(m.scope ?? 'all');
    setPages(m.pages ?? []);
    setEndsAt(toLocalInput(m.endsAt));
  };

  useEffect(() => {
    platformAdminApi.getMaintenance().then((res) => apply(res.data)).catch((err) => setError(err.message));
  }, []);

  const togglePage = (key) => setPages((p) => (p.includes(key) ? p.filter((k) => k !== key) : [...p, key]));

  const save = async (enabled) => {
    setError(null);
    setNotice(null);
    if (enabled && scope === 'selected' && pages.length === 0) { setError('Choose at least one area, or show it on every page.'); return; }
    setBusy(true);
    try {
      const res = await platformAdminApi.setMaintenance({
        enabled,
        message,
        scope,
        pages: scope === 'selected' ? pages : [],
        endsAt: endsAt ? new Date(endsAt).toISOString() : null,
        notifyUsers: enabled && notify && !state?.enabled,
      });
      apply({ ...res.data, pageGroups: state?.pageGroups });
      setNotice(enabled ? (state?.enabled ? 'Maintenance mode updated.' : 'Maintenance mode is on.') : 'Maintenance mode is off.');
    } catch (err) {
      setError(err.details?.map((d) => d.message).join(' ') || err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!state && !error) return <LoadingState label="Loading maintenance settings…" />;
  const on = Boolean(state?.enabled);

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader
        icon={Wrench}
        eyebrow="Platform"
        title="Maintenance mode"
        description="Tell everyone the system is under maintenance — on every page or only the areas you choose — and email all users."
        action={<Badge tone={on ? 'warning' : 'success'}>{on ? 'Maintenance is ON' : 'System is running normally'}</Badge>}
      />

      {error && <Alert variant="error">{error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}

      <Card>
        <CardBody className="flex flex-col gap-5">
          <TextareaField
            label="Message people will see"
            hint="For example: We are upgrading the database. Please check back in about an hour."
            rows={3}
            maxLength={1000}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <Field
            label="Expected back (optional)"
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            hint="Shown in the notice and in the email."
          />

          <fieldset className="flex flex-col gap-3">
            <legend className="text-sm font-medium text-slate-700 dark:text-slate-300">Where should the notice show?</legend>
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input type="radio" name="scope" checked={scope === 'all'} onChange={() => setScope('all')} className="h-4 w-4 text-brand-600 focus:ring-brand-500" />
              On every page — the website, sign-in pages and the whole application
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input type="radio" name="scope" checked={scope === 'selected'} onChange={() => setScope('selected')} className="h-4 w-4 text-brand-600 focus:ring-brand-500" />
              Only the areas I choose
            </label>
            {scope === 'selected' && (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {MAINTENANCE_GROUPS.map((g) => (
                  <label key={g.key} className="flex min-w-0 items-start gap-2.5 rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700">
                    <input type="checkbox" checked={pages.includes(g.key)} onChange={() => togglePage(g.key)} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-slate-600" />
                    <span className="min-w-0">
                      <span className="block font-medium text-slate-900 dark:text-slate-100">{g.label}</span>
                      <span className="block text-xs text-slate-500 dark:text-slate-400">{g.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </fieldset>

          {!on && (
            <label className="flex items-start gap-2.5 rounded-lg bg-slate-50 p-3 text-sm text-slate-700 dark:bg-slate-800/50 dark:text-slate-300">
              <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-slate-600" />
              <span><Mail size={14} className="mr-1 inline" aria-hidden="true" />Email every user (in every company) that the system is under maintenance when I turn it on.</span>
            </label>
          )}

          <div className="flex flex-wrap items-center justify-end gap-3">
            {on && <Button variant="secondary" loading={busy} onClick={() => save(false)}>Turn maintenance off</Button>}
            <Button loading={busy} onClick={() => save(true)}>{on ? 'Update notice' : 'Turn maintenance on'}</Button>
          </div>
        </CardBody>
      </Card>

      {state?.lastNotice && (
        <Card>
          <CardBody className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300">
            <Mail size={16} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />
            {state.lastNotice.sending
              ? 'Emails are being sent to your users now…'
              : <span>Last email notice: {dateTimeFmt.format(new Date(state.lastNotice.at))} — {state.lastNotice.sent} sent{state.lastNotice.failed ? `, ${state.lastNotice.failed} failed` : ''} of {state.lastNotice.total} users.</span>}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
