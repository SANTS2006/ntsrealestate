import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, Mail, Phone, User, Users } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../../components/ui/Card.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { LoadingState } from '../../components/ui/Spinner.jsx';
import { tenantMessagesApi } from '../../api/tenantMessages.js';

const dateTimeFmt = new Intl.DateTimeFormat('en-US', { dateStyle: 'full', timeStyle: 'short' });

function Row({ icon: Icon, label, children }) {
  if (!children) return null;
  return (
    <div className="flex min-w-0 items-start gap-3">
      <Icon size={16} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
        <p className="break-words text-sm text-slate-800 dark:text-slate-200">{children}</p>
      </div>
    </div>
  );
}

// One tenant message in full — shown to the tenant who sent it, the
// maintenance manager / agent it reached, and the administrator.
export default function TenantMessageDetailPage() {
  const { id } = useParams();
  const [m, setM] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setM(null);
    setError(null);
    tenantMessagesApi.get(id).then((res) => setM(res.data)).catch((err) => setError(err.message));
  }, [id]);

  if (error) return <Alert variant="error">{error}</Alert>;
  if (!m) return <LoadingState label="Loading message…" />;

  const back = m.viewerIsSender ? '/message-manager' : '/tenant-messages';

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link to={back} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"><ArrowLeft size={14} aria-hidden="true" /> Back to messages</Link>
        <h1 className="mt-2 text-xl font-semibold text-slate-900 dark:text-slate-100">Message details</h1>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">From {m.tenant.firstName} {m.tenant.lastName}</h2>
            <Badge tone={m.readAt ? 'success' : 'warning'}>{m.readAt ? 'Read' : 'Unread'}</Badge>
          </CardHeader>
          <CardBody className="flex flex-col gap-4">
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-800 dark:text-slate-100">{m.content}</p>
            <p className="text-xs text-slate-400">Sent {dateTimeFmt.format(new Date(m.createdAt))}</p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Details</h2></CardHeader>
          <CardBody className="flex flex-col gap-4">
            <Row icon={User} label="Tenant">{m.tenant.firstName} {m.tenant.lastName}</Row>
            <Row icon={Mail} label="Tenant email">{m.tenant.email}</Row>
            <Row icon={Phone} label="Tenant phone">{m.tenant.phone}</Row>
            <Row icon={Building2} label="Property">{m.property ? `${m.property.name}${m.property.city ? `, ${m.property.city}` : ''}` : null}</Row>
            <Row icon={Users} label="Delivered to">{m.sentTo?.length ? m.sentTo.map((x) => `${x.name}${x.readAt ? ' (read)' : ''}`).join(', ') : `${m.recipient.firstName} ${m.recipient.lastName}`}</Row>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
