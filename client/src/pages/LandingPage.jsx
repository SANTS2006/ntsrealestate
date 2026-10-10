import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { Logo } from '../components/ui/Logo.jsx';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { apiClient } from '../api/client.js';

function CompanyTile({ company }) {
  const [broken, setBroken] = useState(false);
  const initials = company.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
  return (
    <Link
      to={`/${company.slug}/login`}
      className="group flex w-24 flex-col items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-2 text-center shadow-sm transition hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
    >
      {company.logoUrl && !broken ? (
        <img src={company.logoUrl} alt="" width={36} height={36} className="h-9 w-9 rounded-xl object-contain" onError={() => setBroken(true)} />
      ) : (
        <span className="flex h-9 w-9 items-center justify-center rounded-lg text-xs font-semibold text-white" style={{ backgroundColor: company.primaryColor }}>
          {initials}
        </span>
      )}
      <span className="line-clamp-2 text-[11px] font-medium leading-tight text-slate-800 group-hover:text-slate-950 dark:text-slate-200 dark:group-hover:text-white">{company.name}</span>
    </Link>
  );
}

// The bare, org-less "/" — the platform's home page. Lists every active real
// estate company with its logo; each is a link to that company's own sign-in
// page. Also where a cold visit, a bookmark to the root, or an expired
// session with no remembered org (see ProtectedRoute.jsx) lands.
export default function LandingPage() {
  useDocumentTitle('NTS Real Estate System');
  const [companies, setCompanies] = useState(null);

  useEffect(() => {
    apiClient.get('/public/organizations')
      .then((res) => setCompanies(res.data))
      .catch(() => setCompanies([]));
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-slate-50 px-4 py-10 text-center dark:bg-slate-950">
      <Logo size={64} />
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">NTS Real Estate System</h1>
        <p className="mt-2 max-w-sm text-sm text-slate-500 dark:text-slate-400">
          Choose your real estate company to sign in, or manage them from the platform console.
        </p>
      </div>

      {companies && companies.length > 0 && (
        <nav aria-label="Real estate companies" className="custom-scrollbar flex max-h-64 max-w-2xl flex-wrap items-stretch justify-center gap-2 overflow-y-auto p-1">
          {companies.map((c) => <CompanyTile key={c.slug} company={c} />)}
        </nav>
      )}

      <Link
        to="/platform-admin/login"
        className="flex items-center gap-2 rounded-full border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
      >
        <ShieldCheck size={16} aria-hidden="true" />
        Platform admin console
      </Link>
    </div>
  );
}
