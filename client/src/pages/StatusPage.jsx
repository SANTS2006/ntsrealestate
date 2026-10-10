import { useEffect, useState } from 'react';
import { CheckCircle2, CircleDashed, ServerCog, ShieldCheck, DatabaseZap } from 'lucide-react';
import { apiClient } from '../api/client.js';
import { ThemeToggle } from '../components/ui/ThemeToggle.jsx';
import { Logo } from '../components/ui/Logo.jsx';

const ROADMAP = [
  { phase: 1, title: 'Project Foundation & Architecture', status: 'done' },
  { phase: 2, title: 'Database Schema (Neon + Prisma)', status: 'done' },
  { phase: 3, title: 'Express Foundation & Security Middleware', status: 'done' },
  { phase: 4, title: 'Authentication (Sessions + JWT + MFA)', status: 'done' },
  { phase: 5, title: 'Authorization (RBAC + Org Isolation)', status: 'done' },
  { phase: 6, title: 'Cloudinary Document Storage', status: 'done' },
  { phase: 7, title: 'Core Modules (Properties, Units, Tenants, Leases)', status: 'done' },
  { phase: 8, title: 'Finance (Invoices, Payments, Expenses)', status: 'done' },
  { phase: 9, title: 'Operations (Maintenance, Vendors, Inspections)', status: 'done' },
  { phase: 10, title: 'Dashboard, Reports & Notifications', status: 'done' },
  { phase: 11, title: 'Testing & Security Hardening', status: 'done' },
];

function StatusBadge({ healthy }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${
        healthy === null
          ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
          : healthy
          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
          : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400'
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${healthy === null ? 'bg-slate-400' : healthy ? 'bg-emerald-500' : 'bg-rose-500'}`} />
      {healthy === null ? 'Checking…' : healthy ? 'Connected' : 'Unreachable'}
    </span>
  );
}

export default function StatusPage() {
  const [health, setHealth] = useState({ loading: true, data: null, error: null });

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get('/health')
      .then((res) => {
        if (!cancelled) setHealth({ loading: false, data: res.data, error: null });
      })
      .catch((err) => {
        if (!cancelled) setHealth({ loading: false, data: null, error: err });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const dbHealthy = health.data?.dependencies?.database === 'connected' ? true : health.error ? false : null;

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <Logo size={36} />
            <div>
              <p className="text-sm font-semibold leading-none">NTS Real Estate System</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Property Management System</p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <section aria-labelledby="api-status-heading" className="mb-10 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <h1 id="api-status-heading" className="flex items-center gap-2 text-lg font-semibold">
              <ServerCog size={20} className="text-brand-600" aria-hidden="true" />
              API Connectivity
            </h1>
            <StatusBadge healthy={health.loading ? null : !health.error} />
          </div>
          <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
              <DatabaseZap size={18} className="text-slate-400" aria-hidden="true" />
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400">Neon PostgreSQL</dt>
                <dd className="text-sm font-medium">
                  {health.loading ? 'Checking…' : dbHealthy ? 'Connected' : 'Unreachable'}
                </dd>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
              <ShieldCheck size={18} className="text-slate-400" aria-hidden="true" />
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400">Session cookie</dt>
                <dd className="text-sm font-medium">HttpOnly · Secure · SameSite=Lax</dd>
              </div>
            </div>
          </dl>
          {health.error && (
            <p role="alert" className="mt-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-400">
              {health.error.message} — start the API with <code className="font-mono">npm run dev:server</code> and confirm{' '}
              <code className="font-mono">DATABASE_URL</code> points at your Neon project.
            </p>
          )}
        </section>

        <section aria-labelledby="roadmap-heading">
          <h2 id="roadmap-heading" className="mb-4 text-lg font-semibold">Development Roadmap</h2>
          <ol className="space-y-2">
            {ROADMAP.map((item) => (
              <li
                key={item.phase}
                className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900"
              >
                {item.status === 'done' ? (
                  <CheckCircle2 size={18} className="shrink-0 text-emerald-500" aria-hidden="true" />
                ) : (
                  <CircleDashed size={18} className="shrink-0 text-slate-300 dark:text-slate-700" aria-hidden="true" />
                )}
                <span className="text-xs font-mono text-slate-400">P{item.phase}</span>
                <span className={item.status === 'done' ? 'font-medium' : 'text-slate-600 dark:text-slate-400'}>
                  {item.title}
                </span>
              </li>
            ))}
          </ol>
        </section>
      </main>
    </div>
  );
}
