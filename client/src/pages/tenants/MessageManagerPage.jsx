import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, ChevronRight } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../../components/ui/Card.jsx';
import { TextareaField } from '../../components/ui/Input.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { tenantMessagesApi } from '../../api/tenantMessages.js';

// One-directional (Phase 1): a tenant composes a message that reaches the
// agent(s) assigned to their property, as an in-app notification and an
// email. No reply/thread view here yet — a natural follow-up.
export default function MessageManagerPage() {
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);
  const [mine, setMine] = useState([]);
  const loadMine = useCallback(() => { tenantMessagesApi.list({ pageSize: 20 }).then((res) => setMine(res.data)).catch(() => {}); }, []);
  useEffect(() => { loadMine(); }, [loadMine]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;
    setError(null);
    setSubmitting(true);
    try {
      await tenantMessagesApi.create(content.trim());
      setContent('');
      setSent(true);
      loadMine();
    } catch (err) {
      setError(err.details?.map((d) => d.message).join(' ') || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Message your property manager</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Send a message to the agent looking after your home and to the administrators — they'll be notified in the app and by email.</p>
      </div>

      <Card>
        <CardHeader className="flex items-center gap-2">
          <MessageSquare size={16} className="text-brand-600 dark:text-brand-400" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">New message</h2>
        </CardHeader>
        <CardBody>
          {sent && <Alert variant="success" className="mb-4">Your message has been sent.</Alert>}
          {error && <Alert variant="error" className="mb-4">{error}</Alert>}
          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <TextareaField
              label="Message"
              placeholder="e.g. The kitchen faucet has been leaking since yesterday — could someone take a look?"
              rows={5}
              value={content}
              onChange={(e) => { setContent(e.target.value); setSent(false); }}
            />
            <div className="flex justify-end">
              <Button type="submit" loading={submitting} disabled={!content.trim()}>Send message</Button>
            </div>
          </form>
        </CardBody>
      </Card>

      {mine.length > 0 && (
        <Card>
          <CardHeader><h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Messages you sent</h2></CardHeader>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {mine.map((m) => (
              <li key={m.id}>
                <Link to={`/message-manager/${m.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 sm:px-6 dark:hover:bg-slate-800/40">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-slate-800 dark:text-slate-200">{m.content}</p>
                    <p className="text-xs text-slate-400">{new Date(m.createdAt).toLocaleString()}{m.property ? ` · ${m.property.name}` : ''}</p>
                  </div>
                  <ChevronRight size={16} className="shrink-0 text-slate-300" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
