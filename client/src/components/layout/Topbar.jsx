import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { Menu, Bell, LogOut, ChevronDown, Check, Repeat, Settings } from 'lucide-react';
import { ThemeToggle } from '../ui/ThemeToggle.jsx';
import { WebsiteLink } from '../ui/WebsiteLink.jsx';
import { UserAvatar } from '../ui/UserAvatar.jsx';
import { Logo } from '../ui/Logo.jsx';
import { signOutWithNotice } from '../ui/SignOutOverlay.jsx';
import { useAuth, getLoginPath } from '../../contexts/AuthContext.jsx';
import { useOptionalChat } from '../../contexts/ChatContext.jsx';
import { useNotifications } from '../../contexts/NotificationsContext.jsx';
import { authApi } from '../../api/auth.js';

function useOutsideClick(ref, onOutside) {
  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) onOutside();
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [ref, onOutside]);
}

export function Topbar({ onMenuClick }) {
  const { user, logout, avatarVersion, refreshUser } = useAuth();
  const navigate = useNavigate();
  const chat = useOptionalChat();
  const [menuOpen, setMenuOpen] = useState(false);
  const live = useNotifications();
  const unreadCount = live?.unreadCount ?? 0;
  const [loggingOut, setLoggingOut] = useState(false);
  const menuRef = useRef(null);
  useOutsideClick(menuRef, () => setMenuOpen(false));

  // People with more than one role pick which one they are acting as; the
  // menu, pages and permissions all follow it.
  const assigned = user?.assignedRoles ?? [];
  const [switching, setSwitching] = useState(false);
  const switchRole = async (role) => {
    setSwitching(true);
    try {
      await authApi.setActiveRole(role);
      await refreshUser();
      setMenuOpen(false);
      navigate('/dashboard', { replace: true });
    } finally {
      setSwitching(false);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    setMenuOpen(false);
    try {
      await signOutWithNotice(async () => {
        await chat?.lockChat();
        await logout();
      });
      navigate(getLoginPath(), { replace: true });
    } catch {
      setLoggingOut(false);
    }
  };

  return (
    <header className="relative z-20 flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex min-w-0 flex-1 items-center gap-2 lg:hidden">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open menu"
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <Menu size={20} aria-hidden="true" />
        </button>
        <Logo size={32} className="shrink-0" />
        <span className="min-w-0 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
          <span className="sm:hidden">NTS Real Estate</span>
          <span className="hidden sm:inline">NTS Real Estate System</span>
        </span>
      </div>

      <p className="hidden text-base font-semibold text-slate-900 dark:text-slate-100 lg:block">NTS Real Estate System</p>

      <div className="flex shrink-0 items-center gap-0.5 sm:gap-2">
        <WebsiteLink />
        <ThemeToggle />

        <Link
          to="/notifications"
          aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications'}
          className="relative shrink-0 rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <Bell size={18} className={unreadCount > 0 ? 'origin-top animate-[wiggle_0.6s_ease-in-out_1]' : undefined} aria-hidden="true" />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Link>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <span className="relative shrink-0">
              <UserAvatar user={user} size={36} className="text-xs" refreshKey={avatarVersion} />
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" aria-hidden="true" />
              {unreadCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 sm:hidden items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white ring-2 ring-white dark:ring-slate-900" aria-label={`${unreadCount} unread notifications`}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </span>
            <span className="hidden min-w-0 text-left sm:block">
              <span className="block truncate text-sm font-semibold leading-tight text-slate-900 dark:text-slate-100">{user?.firstName} {user?.lastName}</span>
              <span className="block truncate text-xs capitalize leading-tight text-slate-500 dark:text-slate-400">{(user?.roles ?? []).join(', ').replace(/_/g, ' ')}</span>
            </span>
            <ChevronDown size={14} className={clsx('text-slate-400 transition-transform', menuOpen && 'rotate-180')} aria-hidden="true" />
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full z-30 mt-1 w-64 rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="border-b border-slate-100 px-3 py-2.5 dark:border-slate-800">
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{user?.firstName} {user?.lastName}</p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">{user?.email}</p>
                <p className="text-xs capitalize text-slate-500 dark:text-slate-400">{user?.roles?.join(', ').replace(/_/g, ' ')}</p>
              </div>
              {assigned.length > 1 && (
                <div className="border-b border-slate-100 px-1 py-1 dark:border-slate-800">
                  <p className="flex items-center gap-1.5 px-2 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400"><Repeat size={11} aria-hidden="true" /> Act as</p>
                  {assigned.map((r) => (
                    <button key={r} type="button" role="menuitemradio" aria-checked={user.activeRole === r} disabled={switching} onClick={() => switchRole(r)}
                      className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm capitalize text-slate-700 hover:bg-slate-100 disabled:opacity-60 dark:text-slate-200 dark:hover:bg-slate-800">
                      {r.replace(/_/g, ' ')}
                      {user.activeRole === r && <Check size={14} className="text-brand-600" aria-hidden="true" />}
                    </button>
                  ))}
                  <button type="button" role="menuitemradio" aria-checked={!user.activeRole} disabled={switching} onClick={() => switchRole(null)}
                    className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-60 dark:text-slate-200 dark:hover:bg-slate-800">
                    All my roles
                    {!user.activeRole && <Check size={14} className="text-brand-600" aria-hidden="true" />}
                  </button>
                </div>
              )}
              <div className="flex flex-col gap-0.5 px-1 py-1">
                <Link to="/notifications" role="menuitem" onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
                  <Bell size={15} aria-hidden="true" />
                  Notifications
                  {unreadCount > 0 && <span className="ml-auto rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">{unreadCount > 99 ? '99+' : unreadCount}</span>}
                </Link>
                <Link to="/settings" role="menuitem" onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
                  <Settings size={15} aria-hidden="true" />
                  Settings
                </Link>
                <button type="button" role="menuitem" onClick={handleLogout} disabled={loggingOut} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50 disabled:opacity-60 dark:text-rose-400 dark:hover:bg-rose-950/30">
                  <LogOut size={15} aria-hidden="true" />
                  {loggingOut ? 'Signing out…' : 'Sign out'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
