import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { ErrorBoundary } from '../components/ErrorBoundary.jsx';
import { LogOut, LayoutDashboard, Building2, Users, UserCog, ScrollText, MessagesSquare, Wrench, DatabaseBackup, Menu, X } from 'lucide-react';
import clsx from 'clsx';
import { Button } from '../components/ui/Button.jsx';
import { signOutWithNotice } from '../components/ui/SignOutOverlay.jsx';
import { ThemeToggle } from '../components/ui/ThemeToggle.jsx';
import { usePlatformAdmin } from '../contexts/PlatformAdminContext.jsx';
import { useBranding } from '../contexts/BrandingContext.jsx';
import { ChatProvider, useOptionalChat } from '../contexts/ChatContext.jsx';
import { CallProvider } from '../contexts/CallContext.jsx';
import { CallOverlay } from '../components/chat/CallOverlay.jsx';

const NAV = [
  { to: '/platform-admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/platform-admin/organizations', label: 'Organizations', icon: Building2 },
  { to: '/platform-admin/administrators', label: 'Administrators', icon: Users },
  { to: '/platform-admin/support', label: 'Support chat', icon: MessagesSquare },
  { to: '/platform-admin/maintenance', label: 'Maintenance', icon: Wrench },
  { to: '/platform-admin/backups', label: 'Backup & recovery', icon: DatabaseBackup },
  { to: '/platform-admin/audit-log', label: 'Audit log', icon: ScrollText },
  { to: '/platform-admin/account', label: 'My account', icon: UserCog },
];

// Shell for every signed-in platform admin page: a sidebar of sections (a
// slide-over drawer on small screens), a top bar, and the page itself. Pins the platform identity so a tenant's branding can
// never show through while it is mounted.
export default function PlatformAdminLayout() {
  const { admin } = usePlatformAdmin();
  if (!admin) return null;
  return (
    <ChatProvider actor={{ kind: 'platform', id: admin.id }}>
      <CallProvider>
        <CallOverlay />
        <PlatformShell />
      </CallProvider>
    </ChatProvider>
  );
}

function PlatformShell() {
  const location = useLocation();
  const chat = useOptionalChat();
  const { enterPlatformMode, leavePlatformMode } = useBranding();
  useEffect(() => {
    enterPlatformMode();
    return leavePlatformMode;
  }, [enterPlatformMode, leavePlatformMode]);
  const { admin, logout } = usePlatformAdmin();
  const [drawerOpen, setDrawerOpen] = useState(false);
  // The drawer closes whenever the person navigates.
  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);

  const brand = (onClose) => (
    <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-4 dark:border-slate-800">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex shrink-0 items-center justify-center rounded-lg bg-white px-1.5 py-0.5 ring-1 ring-slate-200">
          <img src="/logo-nts.png" alt="NTS Digital Solutions" className="h-8 w-auto" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">NTS Real Estate System</p>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">Platform Admin</p>
        </div>
      </div>
      {onClose && (
        <button type="button" onClick={onClose} aria-label="Close menu" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">
          <X size={18} aria-hidden="true" />
        </button>
      )}
    </div>
  );

  const nav = (
    <nav aria-label="Platform admin sections" className="custom-scrollbar flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => clsx(
            'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            isActive
              ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100',
          )}
        >
          <Icon size={17} aria-hidden="true" />
          <span className="truncate">{label}</span>
          {to.endsWith('/support') && (chat?.totalUnread ?? 0) > 0 && (
            <span className="ml-auto rounded-full bg-brand-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">{chat.totalUnread}</span>
          )}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="flex h-[100vh] h-[100dvh] overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:flex">
        {brand()}
        {nav}
      </aside>

      {/* Mobile drawer: always mounted so it can slide in and out. */}
      <div className={clsx('fixed inset-0 z-40 lg:hidden', !drawerOpen && 'pointer-events-none')} aria-hidden={!drawerOpen}>
        <div className={clsx('absolute inset-0 bg-slate-950/50 transition-opacity duration-300', drawerOpen ? 'opacity-100' : 'opacity-0')} onClick={() => setDrawerOpen(false)} aria-hidden="true" />
        <div className={clsx('absolute inset-y-0 left-0 flex w-64 max-w-[85vw] flex-col bg-white shadow-xl transition-transform duration-300 ease-in-out dark:bg-slate-900', drawerOpen ? 'translate-x-0' : '-translate-x-full')}>
          {brand(() => setDrawerOpen(false))}
          {nav}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900 sm:px-6">
          <button type="button" onClick={() => setDrawerOpen(true)} aria-label="Open menu" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 lg:hidden">
            <Menu size={20} aria-hidden="true" />
          </button>
          <div className="hidden lg:block" />
          <div className="flex min-w-0 items-center gap-3">
            <span className="hidden truncate text-sm text-slate-500 dark:text-slate-400 sm:inline">{admin?.email}</span>
            <ThemeToggle />
            <Button variant="secondary" size="sm" onClick={() => signOutWithNotice(async () => { await chat?.lockChat(); await logout(); })} className="whitespace-nowrap">
              <LogOut size={15} aria-hidden="true" />
              Sign out
            </Button>
          </div>
        </header>

        <main id="main-content" tabIndex={-1} className="custom-scrollbar min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
          <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
            <ErrorBoundary resetKey={location.pathname}><Outlet /></ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}
