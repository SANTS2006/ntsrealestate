import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import { Bell, X } from 'lucide-react';
import { API_URL } from '../config/env.js';
import { notificationsApi } from '../api/notifications.js';

const NotificationsContext = createContext(null);
const TOAST_MS = 7000;
const MAX_TOASTS = 3;

function socketOrigin() {
  try {
    return new URL(API_URL, window.location.origin).origin;
  } catch {
    return window.location.origin;
  }
}

// Live notifications for the signed-in person: one socket that hears about new
// ones the moment they are created, keeps the unread badge right (across
// every open tab), pops a small toast, and (if allowed) a desktop alert when
// the tab is in the background. Pages can `subscribe` to refresh their lists.
export function NotificationsProvider({ children }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [toasts, setToasts] = useState([]);
  const [connected, setConnected] = useState(false);
  const listeners = useRef(new Set());

  const refreshCount = useCallback(async () => {
    try {
      const res = await notificationsApi.list({ unreadOnly: true, pageSize: 1 });
      setUnreadCount(res.meta?.unreadCount ?? 0);
    } catch {
      // keep what we have
    }
  }, []);

  const subscribe = useCallback((fn) => {
    listeners.current.add(fn);
    return () => listeners.current.delete(fn);
  }, []);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  useEffect(() => {
    refreshCount();
    const socket = io(socketOrigin(), { withCredentials: true, transports: ['websocket', 'polling'] });
    // A reconnect may have missed events while offline: recount.
    socket.on('connect', () => { setConnected(true); refreshCount(); });
    socket.on('disconnect', () => setConnected(false));
    socket.on('notification:new', (n) => {
      setUnreadCount((c) => c + 1);
      setToasts((t) => [n, ...t.filter((x) => x.id !== n.id)].slice(0, MAX_TOASTS));
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== n.id)), TOAST_MS);
      listeners.current.forEach((fn) => { try { fn(n); } catch { /* a page's handler must not break others */ } });
      try {
        if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
          const desktop = new Notification(n.title, { body: n.message, icon: '/icon-192.png', tag: n.id });
          desktop.onclick = () => { window.focus(); window.location.assign(`/notifications?open=${n.id}`); };
        }
      } catch { /* desktop alerts are a bonus */ }
    });
    // Read on another tab or device: bring this badge in line.
    socket.on('notification:read', () => refreshCount());
    socket.on('notification:read-all', () => { setUnreadCount(0); });
    return () => { socket.disconnect(); };
  }, [refreshCount]);

  const value = useMemo(() => ({ unreadCount, setUnreadCount, refreshCount, subscribe, connected }), [unreadCount, refreshCount, subscribe, connected]);

  return (
    <NotificationsContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-3 top-[4.5rem] z-[60] flex w-[min(22rem,calc(100vw-1.5rem))] flex-col gap-2 sm:right-5" aria-live="polite">
        {toasts.map((n) => (
          <div key={n.id} role="status" className="pointer-events-auto flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-900">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400"><Bell size={16} aria-hidden="true" /></span>
            <Link to={`/notifications?open=${n.id}`} onClick={() => dismiss(n.id)} className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{n.title}</p>
              <p className="line-clamp-2 break-words text-xs text-slate-600 dark:text-slate-300">{n.message}</p>
            </Link>
            <button type="button" onClick={() => dismiss(n.id)} aria-label="Dismiss notification" className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800">
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </NotificationsContext.Provider>
  );
}

// Safe where no provider is mounted.
export function useNotifications() {
  return useContext(NotificationsContext);
}
