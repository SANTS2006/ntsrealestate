import { useCallback, useEffect, useState } from 'react';
import { Inbox, Mail, MessageCircle, Phone, Search, Trash2 } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { LoadingState } from '../../components/ui/Spinner.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { platformAdminApi } from '../../api/platformAdmin.js';

const dateTimeFmt = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' });

const STATUSES = [
  { value: 'new', label: 'New', tone: 'brand' },
  { value: 'read', label: 'Read', tone: 'neutral' },
  { value: 'replied', label: 'Replied', tone: 'success' },
  { value: 'archived', label: 'Archived', tone: 'warning' },
];
const statusOf = (value) => STATUSES.find((s) => s.value === value) ?? STATUSES[1];
const digits = (phone) => (phone ?? '').replace(/\D/g, '');

const fieldClass = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';

function Detail({ label, value }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="text-sm text-slate-800 dark:text-slate-200">{value}</dd>
    </div>
  );
}

// Messages and demo requests sent from the public website's Contact and
// Request-a-demo forms. The platform team reads, replies (by email, phone or
// WhatsApp) and tracks each one here.
export default function PlatformAdminInquiriesPage() {
  useDocumentTitle('Inquiries — Platform Admin');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [kind, setKind] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [toDelete, setToDelete] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(() => {
    setError(null);
    platformAdminApi.inquiries({ page, pageSize: 10, status: status || undefined, kind: kind || undefined, search: debouncedSearch || undefined })
      .then((res) => setData({ ...res.data, meta: res.meta }))
      .catch((err) => setError(err.message));
  }, [page, status, kind, debouncedSearch]);

  useEffect(() => { load(); }, [load]);

  const changeStatus = async (id, next) => {
    try {
      await platformAdminApi.updateInquiry(id, { status: next });
      load();
      window.dispatchEvent(new Event('inquiries:changed'));
    } catch (err) { setError(err.message); }
  };

  return (
    <>
      <PageHeader
        icon={Inbox}
        eyebrow="Platform"
        title="Inquiries"
        description="Messages and demo requests sent from the public website."
      />

      {error && <Alert variant="error" className="mt-6">{error}</Alert>}

      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            type="search" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, company or message" aria-label="Search inquiries"
            className={`${fieldClass} w-full pl-9 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30`}
          />
        </div>
        <select value={kind} onChange={(e) => { setKind(e.target.value); setPage(1); }} aria-label="Filter by type" className={fieldClass}>
          <option value="">All types</option>
          <option value="demo">Demo requests</option>
          <option value="contact">Contact messages</option>
        </select>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Filter by status" className={fieldClass}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {data && data.unread > 0 && (
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400"><strong className="text-slate-900 dark:text-slate-100">{data.unread}</strong> new {data.unread === 1 ? 'inquiry' : 'inquiries'} waiting.</p>
      )}

      <div className="mt-4 flex flex-col gap-3">
        {!data && !error && <div className="rounded-xl border border-slate-200 bg-white p-8 dark:border-slate-800 dark:bg-slate-900"><LoadingState label="Loading inquiries…" /></div>}
        {data && data.inquiries.length === 0 && (
          <p className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">No inquiries yet. Messages from the website&apos;s Contact and Request-a-demo forms appear here.</p>
        )}
        {data?.inquiries.map((q) => {
          const s = statusOf(q.status);
          const wa = digits(q.phone);
          return (
            <article key={q.id} className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{q.name}</h2>
                    <Badge tone={q.kind === 'demo' ? 'brand' : 'neutral'}>{q.kind === 'demo' ? 'Demo request' : 'Contact message'}</Badge>
                    <Badge tone={s.tone}>{s.label}</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{dateTimeFmt.format(new Date(q.createdAt))}{q.source ? ` · from ${q.source}` : ''}</p>
                </div>
                <select
                  value={q.status} onChange={(e) => changeStatus(q.id, e.target.value)} aria-label={`Status for ${q.name}`}
                  className={fieldClass}
                >
                  {STATUSES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Detail label="Email" value={q.email} />
                <Detail label="Phone" value={q.phone} />
                <Detail label="Company" value={q.company} />
                <Detail label={q.kind === 'demo' ? 'Main interest' : 'Topic'} value={q.interest} />
                <Detail label="Portfolio size" value={q.portfolioSize} />
              </dl>

              {q.message && <p className="mt-4 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-700 dark:bg-slate-800/60 dark:text-slate-300">{q.message}</p>}

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <a
                  href={`mailto:${q.email}?subject=${encodeURIComponent(`Re: your ${q.kind === 'demo' ? 'demo request' : 'message'} to NTS Real Estate System`)}`}
                  onClick={() => q.status === 'new' && changeStatus(q.id, 'read')}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <Mail size={14} aria-hidden="true" /> Reply by email
                </a>
                {q.phone && (
                  <a href={`tel:${q.phone}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                    <Phone size={14} aria-hidden="true" /> Call
                  </a>
                )}
                {wa.length >= 7 && (
                  <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                    <MessageCircle size={14} aria-hidden="true" /> WhatsApp
                  </a>
                )}
                <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setToDelete(q)}>
                  <Trash2 size={14} aria-hidden="true" /> Delete
                </Button>
              </div>
            </article>
          );
        })}
      </div>

      {data && data.meta.totalPages > 1 && (
        <div className="mt-4"><Pagination page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} pageSize={data.meta.pageSize} onPageChange={setPage} /></div>
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        title="Delete this inquiry?"
        description={toDelete ? `This permanently removes ${toDelete.name}'s ${toDelete.kind === 'demo' ? 'demo request' : 'message'}. This cannot be undone.` : ''}
        confirmLabel="Delete"
        onConfirm={async () => {
          await platformAdminApi.deleteInquiry(toDelete.id);
          window.dispatchEvent(new Event('inquiries:changed'));
          load();
        }}
      />
    </>
  );
}
