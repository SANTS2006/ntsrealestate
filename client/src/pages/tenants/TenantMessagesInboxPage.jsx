import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, ChevronRight } from 'lucide-react';
import { Card, CardBody } from '../../components/ui/Card.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { LoadingState } from '../../components/ui/Spinner.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { tenantMessagesApi } from '../../api/tenantMessages.js';

const dateTimeFmt = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' });

// agent: only messages addressed to them (server-scoped). administrator:
// every tenant message org-wide, with the recipient shown per row — see
// tenantMessage.service.js#listInbox for the query-mode branch.
export default function TenantMessagesInboxPage() {
  const [messages, setMessages] = useState(null);
  const [meta, setMeta] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setError(null);
    tenantMessagesApi.list({ page, pageSize: 20 })
      .then((res) => { setMessages(res.data); setMeta(res.meta); })
      .catch((err) => setError(err.message));
  }, [page]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Tenant messages</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Messages tenants have sent about their properties.</p>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      <Card>
        {messages === null ? (
          <LoadingState label="Loading messages…" />
        ) : messages.length === 0 ? (
          <CardBody className="flex flex-col items-center gap-2 py-16 text-center">
            <MessageSquare size={28} className="text-slate-300 dark:text-slate-700" aria-hidden="true" />
            <p className="text-sm text-slate-500 dark:text-slate-400">No tenant messages yet.</p>
          </CardBody>
        ) : (
          <>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {messages.map((m) => (
                <li key={m.id}>
                  <Link to={`/tenant-messages/${m.id}`} className="flex items-start gap-3 px-4 py-4 hover:bg-slate-50 sm:px-6 dark:hover:bg-slate-800/40">
                  {!m.readAt && !m.recipient && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand-600" aria-hidden="true" />}
                  <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-slate-900 dark:text-slate-100">
                      {m.tenant ? `${m.tenant.firstName} ${m.tenant.lastName}` : 'A tenant'}
                    </p>
                    {m.property && (
                      <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400">{m.property.name}</span>
                    )}
                    {m.recipient && (
                      <span className="text-xs text-slate-400">→ {m.recipient.firstName} {m.recipient.lastName}</span>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-2 break-words text-sm text-slate-700 dark:text-slate-200">{m.content}</p>
                  <p className="mt-1 text-xs text-slate-400">{dateTimeFmt.format(new Date(m.createdAt))}</p>
                  </div>
                  <ChevronRight size={16} className="mt-1 shrink-0 text-slate-300" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
            <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} pageSize={meta.pageSize} onPageChange={setPage} />
          </>
        )}
      </Card>
    </div>
  );
}
