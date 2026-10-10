import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Briefcase, Users, UserCircle, Network } from 'lucide-react';
import { ownersApi } from '../../api/owners.js';
import { tenantsApi } from '../../api/tenants.js';
import { Spinner } from '../ui/Spinner.jsx';

const chip = 'inline-flex max-w-full items-center truncate rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200';

function Row({ icon: Icon, label, items, render, empty }) {
  return (
    <div>
      <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        <Icon size={12} aria-hidden="true" />{label} <span className="font-normal normal-case">({items.length})</span>
      </p>
      {items.length === 0 ? <p className="text-xs text-slate-400">{empty}</p> : <div className="flex flex-wrap gap-1.5">{items.map(render)}</div>}
    </div>
  );
}

const Person = (p) => <span key={p.id ?? p.userId} className={chip} title={p.email || ''}>{p.name}{p.linkStatus === 'inactive' ? ' (deactivated)' : ''}{p.property ? ` · ${p.property}${p.unit ? ` · Unit ${p.unit}` : ''}` : ''}</span>;
const Prop = (p) => <Link key={p.id} to={`/properties/${p.id}`} className={`${chip} hover:border-brand-400`}>{p.name}{p.code ? ` · ${p.code}` : ''}</Link>;

// "Who is this person connected to" for an owner or tenant profile: the
// properties, tenants, agents and owners linked to them.
export function ConnectionsPanel({ kind, id }) {
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (kind === 'owner' ? ownersApi.connections(id) : tenantsApi.connections(id))
      .then((res) => { if (!cancelled) setData(res.data); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [kind, id]);

  if (failed) return null;
  return (
    <section className="mb-4 flex flex-col gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800" aria-label="Connections">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200"><Network size={15} aria-hidden="true" />Connections</p>
      {!data ? <Spinner label="Loading connections…" /> : kind === 'owner' ? (
        <>
          <Row icon={Building2} label="Properties" items={data.properties} render={Prop} empty="No properties yet." />
          <Row icon={Briefcase} label="Agents" items={data.agents} render={Person} empty="No agents linked." />
          <Row icon={Users} label="Tenants" items={data.tenants} render={Person} empty="No tenants renting yet." />
        </>
      ) : (
        <>
          <Row
            icon={Building2} label="Renting" items={data.rentals}
            render={(r, i) => <Link key={i} to={`/properties/${r.property.id}`} className={`${chip} hover:border-brand-400`}>{r.property.name}{r.building ? ` · ${r.building}` : ''}{r.unit ? ` · Unit ${r.unit}` : ''}</Link>}
            empty="Not renting anything yet."
          />
          <Row icon={UserCircle} label="Owners" items={data.owners} render={Person} empty="—" />
          <Row icon={Briefcase} label="Agents" items={data.agents} render={Person} empty="—" />
        </>
      )}
    </section>
  );
}
