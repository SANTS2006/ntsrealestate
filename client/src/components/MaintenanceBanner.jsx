import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Wrench } from 'lucide-react';
import { apiClient } from '../api/client.js';
import { groupForPath } from '../config/maintenancePages.js';

const dateFmt = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' });

// Shown across the top of every page (or only the areas the platform admin
// chose) while maintenance mode is on. It asks the server now and then, so it
// appears — and goes away — without anyone reloading.
export function MaintenanceBanner() {
  const { pathname } = useLocation();
  const [status, setStatus] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const check = () => apiClient.get('/public/system-status', { noRetry: true })
      .then((res) => { if (!cancelled) setStatus(res.data.maintenance); })
      .catch(() => {});
    check();
    const timer = setInterval(check, 120_000);
    const onFocus = () => check();
    window.addEventListener('focus', onFocus);
    return () => { cancelled = true; clearInterval(timer); window.removeEventListener('focus', onFocus); };
  }, []);

  const visible = Boolean(status?.enabled) && (status.scope === 'all' || (status.pages ?? []).includes(groupForPath(pathname)));

  // Full-height layouts subtract the banner's height so nothing is pushed off screen.
  useEffect(() => {
    const root = document.documentElement;
    if (!visible || !ref.current) { root.style.setProperty('--maintenance-offset', '0px'); return undefined; }
    const update = () => root.style.setProperty('--maintenance-offset', `${ref.current?.offsetHeight ?? 0}px`);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(ref.current);
    return () => { observer.disconnect(); root.style.setProperty('--maintenance-offset', '0px'); };
  }, [visible]);

  if (!visible) return null;
  return (
    <div ref={ref} role="status" className="relative z-[70] flex items-start gap-3 bg-amber-500 px-4 py-2.5 text-sm text-amber-950">
      <Wrench size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      <p className="min-w-0 break-words">
        <strong className="font-semibold">The system is under maintenance.</strong>{' '}
        {status.message || 'Some pages may be unavailable or slow.'}
        {status.endsAt && <> Expected back {dateFmt.format(new Date(status.endsAt))}.</>}
      </p>
    </div>
  );
}
