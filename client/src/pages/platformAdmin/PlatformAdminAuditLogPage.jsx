import { useCallback, useEffect, useState } from 'react';
import { ScrollText, Search } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { Table, Thead, Tbody, Tr, Th, Td } from '../../components/ui/Table.jsx';
import { LoadingState } from '../../components/ui/Spinner.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { platformAdminApi } from '../../api/platformAdmin.js';

const dateTimeFmt = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' });

const TONE = (action) => {
  if (action.includes('deleted') || action.includes('deactivated')) return 'danger';
  if (action.includes('created') || action.includes('reactivated')) return 'success';
  return 'neutral';
};

const label = (action) => action.replace(/[._]/g, ' ');

export default function PlatformAdminAuditLogPage() {
  useDocumentTitle('Audit log — Platform Admin');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(() => {
    setError(null);
    platformAdminApi.auditLogs({ page, pageSize: 20, action: action || undefined, search: debouncedSearch || undefined })
      .then((res) => setData({ ...res.data, meta: res.meta }))
      .catch((err) => setError(err.message));
  }, [page, action, debouncedSearch]);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <PageHeader icon={ScrollText} eyebrow="Platform" title="Audit log" description="What platform admins have done — sign-ins, organization changes and administrator changes." />

      {error && <Alert variant="error" className="mt-6">{error}</Alert>}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            type="search" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by person or target" aria-label="Search audit log"
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>
        <select
          value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} aria-label="Filter by action"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        >
          <option value="">All actions</option>
          {data?.actions.map((a) => <option key={a} value={a}>{label(a)}</option>)}
        </select>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {!data && !error && <div className="p-8"><LoadingState label="Loading audit log…" /></div>}
        {data && data.logs.length === 0 && <p className="px-6 py-12 text-center text-sm text-slate-500 dark:text-slate-400">No activity recorded yet.</p>}
        {data && data.logs.length > 0 && (
          <>
          <ul className="divide-y divide-slate-100 md:hidden dark:divide-slate-800">
            {data.logs.map((log) => (
              <li key={log.id} className="flex flex-col gap-1.5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <Badge tone={TONE(log.action)}>{label(log.action)}</Badge>
                  <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">{dateTimeFmt.format(new Date(log.createdAt))}</span>
                </div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{log.actorName}</p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">{log.actorEmail}</p>
                {log.targetLabel && <p className="text-sm text-slate-600 dark:text-slate-300">→ {log.targetLabel}</p>}
              </li>
            ))}
          </ul>
          <div className="hidden md:block">
          <Table>
            <Thead>
              <Tr><Th>When</Th><Th>Who</Th><Th>Action</Th><Th>Target</Th></Tr>
            </Thead>
            <Tbody>
              {data.logs.map((log) => (
                <Tr key={log.id}>
                  <Td className="whitespace-nowrap">{dateTimeFmt.format(new Date(log.createdAt))}</Td>
                  <Td>
                    <p className="font-medium text-slate-900 dark:text-slate-100">{log.actorName}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{log.actorEmail}</p>
                  </Td>
                  <Td><Badge tone={TONE(log.action)}>{label(log.action)}</Badge></Td>
                  <Td>{log.targetLabel ?? '—'}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
          </div>
          </>
        )}
      </div>

      {data && data.meta.totalPages > 1 && (
        <div className="mt-4"><Pagination page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} pageSize={data.meta.pageSize} onPageChange={setPage} /></div>
      )}
    </>
  );
}
