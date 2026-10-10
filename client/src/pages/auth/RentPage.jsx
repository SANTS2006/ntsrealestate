import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Home, CheckCircle2 } from 'lucide-react';
import { AuthLayout } from '../../layouts/AuthLayout.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { LoadingState } from '../../components/ui/Spinner.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { rentalsApi } from '../../api/rentals.js';
import { dealsApi } from '../../api/deals.js';
import { saveRentIntent, clearRentIntent } from '../../utils/rentIntent.js';
import { formatCurrency } from '../../utils/currency.js';

// Where the company's website sends someone who wants to rent a unit or a
// building (/:orgSlug/rent?unit=<id> or ?building=<id>). Signed out, it asks
// them to sign in or create an account (remembering what they wanted); signed
// in as a tenant, it registers the place under their one tenant record.
export default function RentPage() {
  const { orgSlug } = useParams();
  const [searchParams] = useSearchParams();
  const unitId = searchParams.get('unit');
  const buildingId = searchParams.get('building');
  const landId = searchParams.get('land');
  const kind = ['rent', 'buy', 'lease'].includes(searchParams.get('kind')) ? searchParams.get('kind') : (landId ? 'buy' : 'rent');
  const { user, loading } = useAuth();
  const [listing, setListing] = useState(null);
  const [state, setState] = useState('idle'); // idle | working | done | error
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const submitted = useRef(false);

  const missingTarget = !unitId && !buildingId && !landId;

  useEffect(() => {
    const load = landId ? rentalsApi.publicLand(orgSlug, landId) : unitId ? rentalsApi.publicListing(orgSlug, unitId) : null;
    load?.then((res) => setListing(res.data)).catch(() => {});
  }, [orgSlug, unitId, landId]);

  useEffect(() => {
    if (loading || missingTarget) return;
    if (!user) {
      saveRentIntent({ orgSlug, unitId, buildingId, landId, kind });
      return;
    }
    if (!user.roles.includes('tenant') || submitted.current) return;
    submitted.current = true;
    setState('working');
    const request = buildingId && !unitId
      ? rentalsApi.request({ buildingId }).then((res) => ({ data: { rental: res.data.rental, alreadyHeld: res.data.alreadyHeld, label: res.data.rental.label } }))
      : dealsApi.request({ kind, ...(landId ? { landId } : { unitId }) }).then((res) => ({ data: { alreadyHeld: res.data.alreadyHeld, label: res.data.deal.subject.title, deal: res.data.deal } }));
    request
      .then((res) => {
        clearRentIntent();
        setResult(res.data);
        setState('done');
      })
      .catch((err) => {
        setError(err.message);
        setState('error');
      });
  }, [loading, user, orgSlug, unitId, buildingId, landId, kind, missingTarget]);

  const WORDS = {
    rent: { title: 'Rent a property', description: 'Register the place you want to rent under your account.', verb: 'rent', working: 'Registering your rental…', price: listing?.offers?.rent ?? listing?.price, per: ' / month' },
    buy: { title: landId ? 'Buy this land' : 'Buy a property', description: 'Tell us you want to buy it — we will reserve it for you and get in touch.', verb: 'buy', working: 'Sending your request…', price: landId ? listing?.price : listing?.offers?.buy, per: '' },
    lease: { title: 'Lease a property', description: 'Request a long-term lease — we will reserve it for you and get in touch.', verb: 'lease', working: 'Sending your request…', price: listing?.offers?.lease?.price, per: ' / year' },
  }[kind];
  const what = listing?.title ?? (landId ? 'this land' : unitId ? 'this unit' : 'this building');

  let body;
  if (missingTarget) {
    body = <Alert variant="error">This rental link is incomplete. Please go back to the website and choose a property again.</Alert>;
  } else if (loading) {
    body = <LoadingState label="Checking your session…" />;
  } else if (!user) {
    body = (
      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-slate-200 bg-white/60 p-4 text-sm dark:border-slate-700 dark:bg-slate-900/40">
          <p className="font-medium text-slate-900 dark:text-slate-100">{what}</p>
          {listing && WORDS.price != null && <p className="mt-1 text-slate-500 dark:text-slate-400">{formatCurrency(WORDS.price)}{WORDS.per}</p>}
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300">To {WORDS.verb} it, sign in — or create an account if you do not have one yet.</p>
        <Link to={`/${orgSlug}/register`}><Button className="w-full">Create an account</Button></Link>
        <Link to={`/${orgSlug}/login`}><Button variant="secondary" className="w-full">I already have an account</Button></Link>
      </div>
    );
  } else if (!user.roles.includes('tenant')) {
    body = <Alert variant="warning">You are signed in with a staff account, which cannot do this. Sign out and use a customer account.</Alert>;
  } else if (state === 'working' || state === 'idle') {
    body = <LoadingState label={WORDS.working} />;
  } else if (state === 'error') {
    body = <Alert variant="error">{error}</Alert>;
  } else {
    body = (
      <div className="flex flex-col items-center gap-3 text-center">
        <CheckCircle2 size={40} className="text-emerald-500" aria-hidden="true" />
        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{result.label}</p>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {result.alreadyHeld
            ? 'This is already registered under your account.'
            : kind === 'rent'
              ? 'It has been added to your account, and the owner and agents have been notified.'
              : 'Your request was sent and it is reserved for you. The team will be in touch to complete it — you can follow it, and your payments, under My deals.'}
        </p>
        <Link to={kind === 'rent' && !result.deal ? '/my-rentals' : '/my-deals'} className="w-full"><Button className="w-full"><Home size={15} aria-hidden="true" /> {kind === 'rent' && !result.deal ? 'View my properties' : 'View my deals'}</Button></Link>
      </div>
    );
  }

  return (
    <AuthLayout title={WORDS.title} description={WORDS.description}>
      {body}
    </AuthLayout>
  );
}
