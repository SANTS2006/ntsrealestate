import { useEffect, useRef, useState } from 'react';
import { tenantAuthApi } from '../../api/tenantAuth.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useTheme } from '../../contexts/ThemeContext.jsx';

const GSI_SRC = 'https://accounts.google.com/gsi/client';
let gsiPromise;
function loadGsi() {
  gsiPromise ??= new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve(window.google);
    const script = document.createElement('script');
    script.src = GSI_SRC;
    script.async = true;
    script.onload = () => resolve(window.google);
    script.onerror = () => { gsiPromise = undefined; reject(new Error('Could not load Google sign-in.')); };
    document.head.appendChild(script);
  });
  return gsiPromise;
}

// Google's own "Sign in with Google" button. Shows nothing at all unless the
// system has a Google client id configured, so it can be switched on later with
// no code change. The browser only ever receives a signed credential from
// Google and hands it to our server, which verifies it.
//   mode "login"    — an existing account only
//   mode "register" — also creates a customer account (needs `getAgreed()` to be true)
export function GoogleSignInButton({ orgSlug, mode = 'login', getAgreed, onResult, onError }) {
  const { loginWithGoogle } = useAuth();
  const { theme } = useTheme(); // re-draw the button when light/dark changes
  const holder = useRef(null);
  const latest = useRef({});
  const [clientId, setClientId] = useState(null);
  latest.current = { orgSlug, mode, getAgreed, onResult, onError, loginWithGoogle };

  useEffect(() => {
    let cancelled = false;
    tenantAuthApi.authConfig(orgSlug).then((res) => { if (!cancelled) setClientId(res.data.googleClientId); }).catch(() => {});
    return () => { cancelled = true; };
  }, [orgSlug]);

  useEffect(() => {
    if (!clientId || !holder.current) return undefined;
    let cancelled = false;
    loadGsi().then((google) => {
      if (cancelled || !holder.current) return;
      google.accounts.id.initialize({
        client_id: clientId,
        callback: async ({ credential }) => {
          const { orgSlug: slug, mode: m, getAgreed: agreed, onResult: done, onError: fail, loginWithGoogle: signIn } = latest.current;
          try {
            if (m === 'register' && !agreed?.()) throw new Error('Please agree to the Terms & Conditions and Privacy Policy first.');
            const result = await signIn(slug, credential, { mode: m, ...(m === 'register' ? { agreedToTerms: true } : {}) });
            done?.(result);
          } catch (err) {
            fail?.(err.message);
          }
        },
      });
      holder.current.innerHTML = '';
      google.accounts.id.renderButton(holder.current, {
        type: 'standard', theme: document.documentElement.classList.contains('dark') ? 'filled_black' : 'outline', size: 'large', shape: 'pill',
        text: mode === 'register' ? 'signup_with' : 'signin_with', logo_alignment: 'left',
        width: Math.min(360, Math.max(200, holder.current.parentElement?.clientWidth ?? 320)),
      });
    }).catch(() => latest.current.onError?.('Google sign-in is not available right now.'));
    return () => { cancelled = true; };
  }, [clientId, mode, theme]);

  if (!clientId) return null;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-slate-400">
        <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
        or
        <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
      </div>
      <div ref={holder} className="flex min-h-[44px] justify-center" />
    </div>
  );
}
