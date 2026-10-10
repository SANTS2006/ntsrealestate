import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

const DISMISS_KEY = 'pwa-install-dismissed';

function wasDismissed() {
  try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
}

// Offers to install the app when the browser says it can be installed.
export function InstallPrompt() {
  const [deferred, setDeferred] = useState(null);

  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault();
      if (!wasDismissed()) setDeferred(e);
    };
    const onInstalled = () => setDeferred(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!deferred) return null;

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* storage unavailable */ }
    setDeferred(null);
  };
  const install = async () => {
    deferred.prompt();
    await deferred.userChoice.catch(() => {});
    setDeferred(null);
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto flex max-w-md items-center gap-3 rounded-xl border border-slate-700 bg-slate-900 p-3 text-slate-100 shadow-xl">
      <Download size={20} className="shrink-0 text-brand-300" aria-hidden="true" />
      <p className="flex-1 text-sm">Install this app on your device for quick access.</p>
      <button type="button" onClick={install} className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-500">Install</button>
      <button type="button" onClick={dismiss} aria-label="Dismiss" className="rounded p-1 text-slate-400 hover:text-white">
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
