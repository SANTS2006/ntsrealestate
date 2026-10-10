import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { Network, Users2, UserCircle, Briefcase, Users, Building2, ShieldCheck, MailQuestion, Link2, Search, Mail, Phone } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { Card, CardBody } from '../../components/ui/Card.jsx';
import { StatCard } from '../../components/ui/StatCard.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { LoadingState } from '../../components/ui/Spinner.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { networkApi } from '../../api/network.js';

const TABS = [
  { key: 'everyone', label: 'Everyone', icon: Users2 },
  { key: 'owners', label: 'Owners', icon: UserCircle },
  { key: 'agents', label: 'Agents', icon: Briefcase },
  { key: 'tenants', label: 'Tenants', icon: Users },
  { key: 'properties', label: 'Properties', icon: Building2 },
  { key: 'staff', label: 'Staff', icon: ShieldCheck },
  { key: 'pending', label: 'Invited', icon: MailQuestion },
];

function AccountBadge({ status }) {
  if (status === 'pending') return <Badge tone="warning">Invited – not signed in yet</Badge>;
  if (status === 'active') return <Badge tone="success">Active</Badge>;
  if (status === 'inactive' || status === 'locked') return <Badge tone="danger">{status === 'locked' ? 'Locked' : 'Deactivated'}</Badge>;
  if (status === null) return <Badge tone="neutral">No login</Badge>;
  return <Badge tone="neutral">{status}</Badge>;
}

function Chips({ label, icon: Icon, items, render, empty }) {
  return (
    <div>
      <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {Icon && <Icon size={12} aria-hidden="true" />}
        {label} <span className="font-normal normal-case">({items.length})</span>
      </p>
      {items.length === 0 ? (
        <p className="text-xs text-slate-400">{empty}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">{items.map(render)}</div>
      )}
    </div>
  );
}

const chip = 'inline-flex max-w-full items-center truncate rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200';
const PropertyChip = (p) => <Link key={p.id} to={`/properties/${p.id}`} className={clsx(chip, 'hover:border-brand-400 hover:text-brand-700 dark:hover:text-brand-300')}>{p.name}{p.code ? ` · ${p.code}` : ''}</Link>;
const NameChip = (p) => <span key={p.id ?? p.userId} className={chip}>{p.name}{p.linkStatus === 'inactive' ? ' (deactivated)' : ''}</span>;

function PersonCard({ title, email, phone, badges, children }) {
  return (
    <Card>
      <CardBody className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-900 dark:text-slate-100">{title}</p>
            <div className="mt-0.5 flex flex-col gap-0.5 text-xs text-slate-500 dark:text-slate-400">
              {email && <span className="flex items-center gap-1 truncate"><Mail size={12} aria-hidden="true" />{email}</span>}
              {phone && <span className="flex items-center gap-1"><Phone size={12} aria-hidden="true" />{phone}</span>}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">{badges}</div>
        </div>
        {children}
      </CardBody>
    </Card>
  );
}

const matches = (q, ...fields) => !q || fields.some((f) => f && String(f).toLowerCase().includes(q));

// The administrator's whole-organization view: every owner, agent, tenant,
// property and staff member, with who and what each one is connected to, plus
// everyone who has been invited but has not signed in yet.
export default function NetworkPage() {
  useDocumentTitle('Network');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('everyone');
  const [query, setQuery] = useState('');

  useEffect(() => {
    networkApi.get().then((res) => setData(res.data)).catch((err) => setError(err.message));
  }, []);

  const q = query.trim().toLowerCase();
  const counts = useMemo(() => (data ? {
    everyone: data.everyone.length, owners: data.owners.length, agents: data.agents.length, tenants: data.tenants.length,
    properties: data.properties.length, staff: data.staff.length, pending: data.pending.length,
  } : {}), [data]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader icon={Network} eyebrow="Administration" title="Network" description="Every owner, agent, tenant and property in your organization, and how they are connected." />
      {error && <Alert variant="error">{error}</Alert>}
      {!data && !error && <Card><LoadingState label="Loading the network…" /></Card>}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-7">
            <StatCard icon={Users2} label="All users" value={data.totals.users} subtext="Every role" tone="brand" />
            <StatCard icon={UserCircle} label="Owners" value={data.totals.owners} subtext="Property owners" tone="brand" />
            <StatCard icon={Briefcase} label="Agents" value={data.totals.agents} subtext={`${data.totals.links} owner links`} tone="success" />
            <StatCard icon={Users} label="Tenants" value={data.totals.tenants} subtext={`${data.totals.activeRentals} active rentals`} tone="brand" />
            <StatCard icon={Building2} label="Properties" value={data.totals.properties} subtext="All properties" tone="neutral" />
            <StatCard icon={ShieldCheck} label="Staff" value={data.totals.staff} subtext="Admins & other roles" tone="neutral" />
            <StatCard icon={MailQuestion} label="Invited" value={data.totals.pending} subtext="Waiting to sign in" tone="warning" />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div role="tablist" aria-label="Network sections" className="flex flex-wrap gap-1.5">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.key}
                  onClick={() => setTab(t.key)}
                  className={clsx(
                    'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                    tab === t.key ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
                  )}
                >
                  <t.icon size={14} aria-hidden="true" />
                  {t.label}
                  <span className={clsx('rounded-full px-1.5 text-xs', tab === t.key ? 'bg-white/20' : 'bg-white dark:bg-slate-900')}>{counts[t.key]}</span>
                </button>
              ))}
            </div>
            <label className="relative sm:w-64">
              <span className="sr-only">Search</span>
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, email, property…"
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </label>
          </div>

          {tab === 'everyone' && (
            <Grid empty="No users match.">
              {data.everyone.filter((u) => matches(q, u.name, u.email, u.phone, ...u.roles)).map((u) => (
                <PersonCard key={u.id} title={u.name} email={u.email} phone={u.phone} badges={<AccountBadge status={u.status} />}>
                  <div className="flex flex-wrap gap-1.5">{u.roles.map((r) => <Badge key={r} tone="brand">{r.replace(/_/g, ' ')}</Badge>)}</div>
                  <p className="text-xs text-slate-400">
                    {u.status === 'pending' ? `Invited ${new Date(u.invitedAt).toLocaleDateString()}` : u.lastLoginAt ? `Last sign-in ${new Date(u.lastLoginAt).toLocaleDateString()}` : 'Has not signed in yet'}
                  </p>
                </PersonCard>
              ))}
            </Grid>
          )}

          {tab === 'owners' && (
            <Grid empty="No owners match.">
              {data.owners.filter((o) => matches(q, o.name, o.email, o.phone, ...o.properties.map((p) => p.name), ...o.agents.map((a) => a.name))).map((o) => (
                <PersonCard key={o.id} title={o.name} email={o.email} phone={o.phone} badges={<>
                  <AccountBadge status={o.accountStatus} />
                  {o.status !== 'active' && <Badge tone="danger">Owner {o.status}</Badge>}
                </>}>
                  <Chips label="Properties" icon={Building2} items={o.properties} render={PropertyChip} empty="No properties yet." />
                  <Chips label="Agents" icon={Briefcase} items={o.agents} render={NameChip} empty="No agents linked." />
                  <Chips label="Tenants" icon={Users} items={o.tenants} render={NameChip} empty="No tenants renting from this owner yet." />
                </PersonCard>
              ))}
            </Grid>
          )}

          {tab === 'agents' && (
            <Grid empty="No agents match.">
              {data.agents.filter((a) => matches(q, a.name, a.email, a.phone, ...a.owners.map((o) => o.name), ...a.properties.map((p) => p.name))).map((a) => (
                <PersonCard key={a.userId} title={a.name} email={a.email} phone={a.phone} badges={<AccountBadge status={a.accountStatus} />}>
                  <Chips label="Works for" icon={UserCircle} items={a.owners} render={NameChip} empty="Not linked to any owner yet." />
                  <Chips label="Properties" icon={Building2} items={a.properties} render={PropertyChip} empty="No properties in scope." />
                  <Chips label="Tenants" icon={Users} items={a.tenants} render={NameChip} empty="No tenants in scope." />
                </PersonCard>
              ))}
            </Grid>
          )}

          {tab === 'tenants' && (
            <Grid empty="No tenants match.">
              {data.tenants.filter((t) => matches(q, t.name, t.email, t.phone, ...t.rentals.map((r) => r.property?.name), ...t.owners.map((o) => o.name), ...t.agents.map((a) => a.name))).map((t) => (
                <PersonCard key={t.id} title={t.name} email={t.email} phone={t.phone} badges={<>
                  <AccountBadge status={t.accountStatus} />
                  {t.status !== 'active' && <Badge tone="neutral">Tenant {t.status}</Badge>}
                </>}>
                  <Chips
                    label="Renting" icon={Building2} items={t.rentals}
                    render={(r, i) => r.property && (
                      <Link key={i} to={`/properties/${r.property.id}`} className={clsx(chip, 'hover:border-brand-400')}>
                        {r.property.name}{r.building ? ` · ${r.building}` : ''}{r.unit ? ` · Unit ${r.unit}` : ''}
                      </Link>
                    )}
                    empty="Not renting anything yet."
                  />
                  <Chips label="Owner" icon={UserCircle} items={t.owners} render={NameChip} empty="—" />
                  <Chips label="Agents" icon={Briefcase} items={t.agents} render={NameChip} empty="—" />
                </PersonCard>
              ))}
            </Grid>
          )}

          {tab === 'properties' && (
            <Grid empty="No properties match.">
              {data.properties.filter((p) => matches(q, p.name, p.code, p.city, p.owner?.name, ...p.agents.map((a) => a.name), ...p.tenants.map((t) => t.name))).map((p) => (
                <PersonCard key={p.id} title={p.name} email={null} phone={null} badges={<Badge tone={p.status === 'active' ? 'success' : 'neutral'}>{p.status}</Badge>}>
                  <p className="-mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {p.code}{p.city ? ` · ${p.city}` : ''} · {p.buildings} building{p.buildings === 1 ? '' : 's'} · {p.occupiedUnits}/{p.units} units occupied
                  </p>
                  <Chips label="Owner" icon={UserCircle} items={p.owner ? [p.owner] : []} render={NameChip} empty="No owner set." />
                  <Chips label="Agents" icon={Briefcase} items={p.agents} render={NameChip} empty="No agents." />
                  <Chips label="Tenants" icon={Users} items={p.tenants} render={NameChip} empty="No tenants." />
                  <Link to={`/properties/${p.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"><Link2 size={12} aria-hidden="true" />Open property</Link>
                </PersonCard>
              ))}
            </Grid>
          )}

          {(tab === 'staff' || tab === 'pending') && (
            <Grid empty={tab === 'staff' ? 'No staff match.' : 'Nobody is waiting to sign in.'}>
              {data[tab].filter((u) => matches(q, u.name, u.email, ...u.roles)).map((u) => (
                <PersonCard key={u.id} title={u.name} email={u.email} phone={u.phone} badges={<AccountBadge status={u.status} />}>
                  <div className="flex flex-wrap gap-1.5">{u.roles.map((r) => <Badge key={r} tone="brand">{r.replace(/_/g, ' ')}</Badge>)}</div>
                  <p className="text-xs text-slate-400">
                    {u.status === 'pending' ? `Invited ${new Date(u.invitedAt).toLocaleDateString()}` : u.lastLoginAt ? `Last sign-in ${new Date(u.lastLoginAt).toLocaleDateString()}` : 'Has not signed in yet'}
                  </p>
                </PersonCard>
              ))}
            </Grid>
          )}
        </>
      )}
    </div>
  );
}

function Grid({ children, empty }) {
  const items = Array.isArray(children) ? children : [children];
  if (items.length === 0) {
    return <Card><CardBody className="py-14 text-center text-sm text-slate-500 dark:text-slate-400">{empty}</CardBody></Card>;
  }
  return <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{children}</div>;
}
