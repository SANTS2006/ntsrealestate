import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Building2 } from 'lucide-react';
import clsx from 'clsx';
import { useOptionalBranding } from '../../contexts/BrandingContext.jsx';

const NTS_LOGO = '/logo-nts.png';

// Which logo to show while something loads: the NTS logo on the platform
// admin console and anywhere no company applies, otherwise the signed-in /
// current company's own logo.
function useLoaderLogo() {
  const { pathname } = useLocation();
  const branding = useOptionalBranding()?.branding;
  if (pathname.startsWith('/platform-admin')) return { src: NTS_LOGO, alt: 'NTS Real Estate System' };
  return { src: branding?.logoUrl || NTS_LOGO, alt: branding?.name || 'Loading' };
}

// The logo sitting inside a ring that spins — the app-wide "something is
// loading" mark.
export function LogoSpinner({ size = 56, className }) {
  const { src, alt } = useLoaderLogo();
  const [errored, setErrored] = useState(false);
  useEffect(() => setErrored(false), [src]);

  return (
    <span className={clsx('relative inline-flex shrink-0 items-center justify-center', className)} style={{ width: size, height: size }} aria-hidden="true">
      <span className="absolute inset-0 rounded-full border-2 border-slate-200 dark:border-slate-700" />
      <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-brand-600 dark:border-t-brand-400" />
      {errored ? (
        <Building2 size={Math.round(size * 0.4)} className="text-brand-600 dark:text-brand-400" />
      ) : (
        <img
          src={src}
          alt={alt}
          onError={() => setErrored(true)}
          className={clsx('rounded-xl', src === NTS_LOGO ? 'object-cover' : 'bg-white object-contain p-0.5')}
          style={{ width: size * 0.62, height: size * 0.62 }}
        />
      )}
    </span>
  );
}

// Compact loader for tables, modals and sections.
export function Spinner({ size = 20, className, label = 'Loading…' }) {
  return (
    <span role="status" className={clsx('inline-flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400', className)}>
      <LogoSpinner size={Math.max(size, 40)} />
      <span className="sr-only">{label}</span>
    </span>
  );
}

// Full-region loading state — used for a page/section that's fetching its
// primary data, distinct from a button's inline spinner.
export function LoadingState({ label = 'Loading…' }) {
  return (
    <div role="status" className="flex flex-col items-center justify-center gap-3 py-16 text-slate-500 dark:text-slate-400">
      <LogoSpinner size={64} />
      <p className="text-sm">{label}</p>
    </div>
  );
}
