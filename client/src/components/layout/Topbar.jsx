import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, Bell, LogOut, ChevronDown, Check, Repeat } from 'lucide-react';
import { ThemeToggle } from '../ui/ThemeToggle.jsx';
import { WebsiteLink } from '../ui/WebsiteLink.jsx';
import { UserAvatar } from '../ui/UserAvatar.jsx';
import { Logo } from '../ui/Logo.jsx';
import { Button } from '../ui/Button.jsx';
import { signOutWithNotice } from '../ui/SignOutOverlay.jsx';
import { useAuth, getLoginPath } from '../../contexts/AuthContext.jsx';
import { useOptionalChat } from '../../contexts/ChatContext.jsx';
import { notificationsApi } from '../../api/notifications.js';
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
  const [unreadCount, setUnreadCount] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);
  const menuRef = useRef(null);
  useOutsideClick(menuRef, () => setMenuOpen(false));

  useEffect(() => {
    let cancelled = false;
    notificationsApi.list({ unreadOnly: true, pageSize: 1 })
      .then((res) => { if (!cancelled) setUnreadCount(res.meta?.unreadCount ?? 0); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

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
    <header className="relative z-20 flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2 lg:hidden">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open menu"
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <Menu size={20} aria-hidden="true" />
        </button>
        <Logo size={28} />
      </div>

      <div className="hidden lg:block" />

      <div className="flex items-center gap-2">
        <WebsiteLink />
        <ThemeToggle />

        <Link
          to="/notifications"
          aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications'}
          className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <Bell size={18} aria-hidden="true" />
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
            <UserAvatar user={user} size={28} className="text-xs" refreshKey={avatarVersion} />
            <span className="hidden text-sm font-medium text-slate-700 dark:text-slate-200 sm:inline">
              {user?.firstName} {user?.lastName}
            </span>
            <ChevronDown size={14} className="text-slate-400" aria-hidden="true" />
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full z-30 mt-1 w-56 rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="border-b border-slate-100 px-3 py-2 dark:border-slate-800">
                <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{user?.email}</p>
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
              <div className="px-1 py-1">
                <Button
                  type="button"
                  role="menuitem"
                  variant="danger"
                  loading={loggingOut}
                  onClick={handleLogout}
                  className="w-full justify-start"
                >
                  <LogOut size={15} aria-hidden="true" />
                  Sign out
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
