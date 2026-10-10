import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Building2, ShieldCheck, TrendingUp, MessageCircle, SearchX } from 'lucide-react';
import { Logo } from '../components/ui/Logo.jsx';
import { ThemeToggle } from '../components/ui/ThemeToggle.jsx';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { useBranding } from '../contexts/BrandingContext.jsx';
import { tenantAuthApi } from '../api/tenantAuth.js';
import { PUBLIC_SITE_URL } from '../config/env.js';
import { WebsiteLink } from '../components/ui/WebsiteLink.jsx';

const HIGHLIGHTS = [
  { icon: Building2, text: 'Manage properties, leases & tenants in one place' },
  { icon: TrendingUp, text: 'Real-time financial and occupancy insights' },
  { icon: ShieldCheck, text: 'Bank-grade security with role-based access' },
];

// Shared shell for every unauthenticated tenant screen (login, register,
// verify email, forgot/reset password) — a modern, minimal split layout: a
// branded panel on large screens, a soft gradient backdrop behind a glass
// form card on every screen size. `key` on the root (passed by each page
// via the route) restarts the entrance animation on every navigation
// between auth screens, which is what reads as a transition between them.
//
// Every route this wraps is nested under /:orgSlug (see App.jsx) — on
// mount this fetches that organization's branding and pushes it into
// BrandingContext, which is what actually repaints the brand/accent colors
// app-wide (see contexts/BrandingContext.jsx). A slug that doesn't resolve
// to any organization renders a plain "not found" message instead of the
// form; a slug that resolves but is deactivated still renders normally —
// the login page's own submit handler is what surfaces that message, once
// someone actually tries to sign in (see auth.service.js#login).
export function AuthLayout({ title, description, children, footer }) {
  const { orgSlug } = useParams();
  const { branding, applyTenantBranding } = useBranding();
  const [status, setStatus] = useState('loading'); // loading | ready | notFound

  useDocumentTitle(title);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    tenantAuthApi.getBranding(orgSlug)
      .then((res) => {
        if (cancelled) return;
        applyTenantBranding(res.data);
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('notFound');
      });
    return () => { cancelled = true; };
  }, [orgSlug, applyTenantBranding]);

  if (status === 'notFound') {
    return (
      <div className="flex h-[calc(100vh-var(--maintenance-offset,0px))] flex-col items-center justify-center gap-3 bg-slate-50 px-4 text-center dark:bg-slate-950">
        <SearchX size={40} className="text-slate-300 dark:text-slate-700" aria-hidden="true" />
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Organization not found</h1>
        <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">
          There's no organization at this address. Double-check the link, or contact whoever gave it to you.
        </p>
      </div>
    );
  }

  if (status === 'loading') {
    return <div className="h-[calc(100vh-var(--maintenance-offset,0px))] bg-slate-50 dark:bg-slate-950" />;
  }

  return (
    <div className="custom-scrollbar flex h-[calc(100vh-var(--maintenance-offset,0px))] overflow-y-auto bg-gradient-to-br from-slate-50 via-brand-50/40 to-accent-50/30 dark:from-slate-950 dark:via-brand-950/40 dark:to-slate-900">
      {/* Brand panel — desktop only */}
      <div className="relative hidden w-[42%] shrink-0 flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-800 via-brand-700 to-accent-700 p-12 text-white lg:flex">
        <div className="pointer-events-none absolute inset-0 opacity-20">
          <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-accent-400 blur-3xl" />
          <div className="absolute -bottom-32 -right-16 h-96 w-96 rounded-full bg-brand-300 blur-3xl" />
        </div>

        <div className="relative flex items-center gap-3">
          <Logo size={44} />
          <div>
            <p className="text-lg font-semibold leading-none">{branding.name}</p>
            <p className="mt-1 text-sm text-white/70">Property Management System</p>
          </div>
        </div>

        <div className="relative">
          <h2 className="text-3xl font-semibold leading-tight">
            Run your entire portfolio from one command center.
          </h2>
          <div className="mt-8 flex flex-col gap-4">
            {HIGHLIGHTS.map((h) => (
              <div key={h.text} className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 backdrop-blur">
                  <h.icon size={18} aria-hidden="true" />
                </span>
                <p className="text-sm text-white/85">{h.text}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-white/50">© {new Date().getFullYear()} {branding.name}. All rights reserved.</p>
      </div>

      {/* Form panel — decorative blurred blobs echo the brand panel, kept
          subtle so the gradient reads as background, not noise. */}
      <div className="relative flex flex-1 flex-col">
        <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-30 dark:opacity-20">
          <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-accent-300 blur-3xl" />
          <div className="absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-brand-300 blur-3xl" />
        </div>

        <header className="relative flex items-center justify-end gap-4 px-6 py-5">
          <a
            href={`${PUBLIC_SITE_URL}/contact`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <MessageCircle size={15} aria-hidden="true" />
            Contact us
          </a>
          <WebsiteLink />
          <ThemeToggle />
        </header>

        <main className="relative flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
          <div className="animate-auth-in w-full max-w-md">
            <div className="rounded-2xl border border-white/60 bg-white/70 p-6 shadow-xl shadow-brand-900/5 backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-900/60 dark:shadow-black/20 sm:p-8">
              <div className="mb-6 flex justify-center">
                <Logo size={72} />
              </div>
              <h1 className="text-center text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">{title}</h1>
              {description && <p className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400">{description}</p>}
              <div className="mt-6">{children}</div>
              {footer && <div className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">{footer}</div>}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
