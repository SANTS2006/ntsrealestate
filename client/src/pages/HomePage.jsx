import { Link } from 'react-router-dom';
import { ArrowUpRight, LayoutDashboard } from 'lucide-react';
import { Button } from '../components/ui/Button.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useBranding } from '../contexts/BrandingContext.jsx';
import { NAV_SECTIONS, isNavItemVisible, visibleChildren } from '../config/navigation.js';

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function QuickLinkCard({ to, icon: Icon, label }) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-700"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
        <Icon size={18} aria-hidden="true" />
      </span>
      <p className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700 dark:text-slate-200">{label}</p>
      <ArrowUpRight size={14} className="shrink-0 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100 dark:text-slate-600" aria-hidden="true" />
    </Link>
  );
}

// The first screen a user sees after signing in — a lightweight welcome +
// quick-navigation hub, distinct from /dashboard's full analytics view
// (which is still one click away via the CTA below).
export default function HomePage() {
  const { user } = useAuth();
  const { branding } = useBranding();
  const roles = user?.roles ?? [];

  const quickLinks = NAV_SECTIONS.filter((item) => item.to !== '/home' && isNavItemVisible(item, roles)).flatMap((item) =>
    item.children
      ? visibleChildren(item, roles).map((child) => ({ to: child.to, icon: item.icon, label: child.label }))
      : [{ to: item.to, icon: item.icon, label: item.label }]
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-800 via-brand-700 to-accent-700 px-6 py-10 text-white sm:px-10">
        <div className="pointer-events-none absolute inset-0 opacity-20">
          <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-accent-300 blur-3xl" />
          <div className="absolute -bottom-20 -left-10 h-64 w-64 rounded-full bg-brand-300 blur-3xl" />
        </div>
        <div className="relative">
          <p className="text-sm font-medium text-white/70">{greeting()}</p>
          <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">Welcome back, {user?.firstName}!</h1>
          <p className="mt-2 max-w-xl text-sm text-white/80">
            Here's your starting point in {branding.name}. Jump straight into what you manage, or head to the full dashboard for portfolio-wide analytics.
          </p>
          <Link to="/dashboard" className="mt-5 inline-block">
            <Button variant="secondary" className="bg-white/95 hover:bg-white">
              <LayoutDashboard size={16} aria-hidden="true" />
              Go to dashboard
            </Button>
          </Link>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Quick access</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {quickLinks.map((link) => (
            <QuickLinkCard key={link.to} to={link.to} icon={link.icon} label={link.label} />
          ))}
        </div>
      </div>
    </div>
  );
}
