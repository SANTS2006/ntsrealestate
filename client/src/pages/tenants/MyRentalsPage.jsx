import { useEffect, useState } from 'react';
import { Home, Building2, MapPin, BedDouble, Bath, User, Mail, Phone, Briefcase } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { Card, CardBody } from '../../components/ui/Card.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { LoadingState } from '../../components/ui/Spinner.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { rentalsApi } from '../../api/rentals.js';
import { formatCurrency } from '../../utils/currency.js';

function Contact({ icon: Icon, name, role, email, phone }) {
  return (
    <li className="flex items-start gap-2.5 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/50">
      <Icon size={15} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />
      <div className="min-w-0 text-sm">
        <p className="truncate font-medium text-slate-900 dark:text-slate-100">{name} <span className="font-normal text-slate-500 dark:text-slate-400">· {role}</span></p>
        {email && <p className="flex items-center gap-1 truncate text-xs text-slate-500 dark:text-slate-400"><Mail size={11} aria-hidden="true" />{email}</p>}
        {phone && <p className="flex items-center gap-1 truncate text-xs text-slate-500 dark:text-slate-400"><Phone size={11} aria-hidden="true" />{phone}</p>}
      </div>
    </li>
  );
}

// Every building or unit registered to the signed-in tenant, with the owner
// and agents who look after each — and nothing else in the system.
export default function MyRentalsPage() {
  useDocumentTitle('My properties');
  const [rentals, setRentals] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    rentalsApi.mine().then((res) => setRentals(res.data)).catch((err) => setError(err.message));
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader icon={Home} eyebrow="My account" title="My properties" description="The buildings and units registered to you, and who looks after them." />
      {error && <Alert variant="error">{error}</Alert>}
      {!rentals && !error && <Card><LoadingState label="Loading your properties…" /></Card>}
      {rentals?.length === 0 && (
        <Card>
          <CardBody className="flex flex-col items-center gap-2 py-16 text-center">
            <Home size={28} className="text-slate-300 dark:text-slate-700" aria-hidden="true" />
            <p className="text-sm text-slate-500 dark:text-slate-400">Nothing is registered to you yet. Choose a property on the company website to rent it.</p>
          </CardBody>
        </Card>
      )}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {rentals?.map((r) => (
          <Card key={r.id}>
            <CardBody className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
                    {r.kind === 'unit' ? <Home size={16} aria-hidden="true" /> : <Building2 size={16} aria-hidden="true" />}
                    <span className="truncate">{r.label}</span>
                  </p>
                  {r.property?.address && (
                    <p className="mt-1 flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
                      <MapPin size={13} aria-hidden="true" />{[r.property.address, r.property.city].filter(Boolean).join(', ')}
                    </p>
                  )}
                </div>
                <Badge tone="success">{r.kind === 'unit' ? 'Unit' : 'Building'}</Badge>
              </div>

              {r.unit && (
                <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600 dark:text-slate-300">
                  {r.unit.bedrooms != null && <span className="flex items-center gap-1"><BedDouble size={14} aria-hidden="true" />{r.unit.bedrooms} bed</span>}
                  {r.unit.bathrooms != null && <span className="flex items-center gap-1"><Bath size={14} aria-hidden="true" />{r.unit.bathrooms} bath</span>}
                  <span>{formatCurrency(r.unit.monthlyRent)} / month</span>
                </div>
              )}

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Owner &amp; agents</p>
                <ul className="flex flex-col gap-2">
                  {r.contacts?.owner && <Contact icon={User} name={r.contacts.owner.name} role="Owner" email={r.contacts.owner.email} phone={r.contacts.owner.phone} />}
                  {r.contacts?.agents.map((a) => <Contact key={a.userId} icon={Briefcase} name={a.name} role="Agent" email={a.email} phone={a.phone} />)}
                  {!r.contacts?.owner && r.contacts?.agents.length === 0 && (
                    <li className="text-sm text-slate-500 dark:text-slate-400">No owner or agent has been assigned to this property yet.</li>
                  )}
                </ul>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
