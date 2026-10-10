import { useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { ErrorBoundary } from '../components/ErrorBoundary.jsx';
import { LogOut, LayoutDashboard, Building2, Users, UserCog, ScrollText, MessagesSquare, Wrench, DatabaseBackup } from 'lucide-react';
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

// Shell for every signed-in platform admin page: header, section tabs, and
// the page itself. Pins the platform identity so a tenant's branding can
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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-4 dark:border-slate-800 dark:bg-slate-900 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center rounded-lg bg-white px-1.5 py-0.5 ring-1 ring-slate-200">
            <img src="/logo-nts.png" alt="NTS Digital Solutions" className="h-8 w-auto" />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">NTS Real Estate System</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Platform Admin</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-slate-500 dark:text-slate-400 sm:inline">{admin?.email}</span>
          <ThemeToggle />
          <Button variant="secondary" size="sm" onClick={() => signOutWithNotice(async () => { await chat?.lockChat(); await logout(); })} className="whitespace-nowrap">
            <LogOut size={15} aria-hidden="true" />
            Sign out
          </Button>
        </div>
      </header>

      <nav aria-label="Platform admin sections" className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <ul className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 sm:px-6">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <li key={to} className="shrink-0">
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) => clsx(
                  'flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition-colors',
                  isActive
                    ? 'border-brand-600 text-brand-700 dark:border-brand-400 dark:text-brand-300'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200',
                )}
              >
                <Icon size={15} aria-hidden="true" />
                {label}
                {to.endsWith('/support') && (chat?.totalUnread ?? 0) > 0 && (
                  <span className="rounded-full bg-brand-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">{chat.totalUnread}</span>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <ErrorBoundary resetKey={location.pathname}><Outlet /></ErrorBoundary>
      </main>
    </div>
  );
}
