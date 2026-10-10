import { useEffect, useState } from 'react';
import { Building2 } from 'lucide-react';
import clsx from 'clsx';
import { useBranding } from '../../contexts/BrandingContext.jsx';

// Renders the current tenant's own logo (BrandingContext — either fetched
// from their branded auth page or their signed-in organization), falling
// back to the platform's own NTS Real Estate System mark, and finally to a
// generic icon badge if even that fails to load — so this never shows a
// broken-image icon no matter what branding state the app is in.
export function Logo({ size = 36, className }) {
  const { branding } = useBranding();
  const [errored, setErrored] = useState(false);

  useEffect(() => setErrored(false), [branding.logoUrl]);

  if (errored || !branding.logoUrl) {
    return (
      <div
        className={clsx('flex shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-600 to-accent-600 text-white', className)}
        style={{ width: size, height: size }}
      >
        <Building2 size={Math.round(size * 0.55)} aria-hidden="true" />
      </div>
    );
  }

  return (
    <img
      src={branding.logoUrl}
      alt={branding.name}
      width={size}
      height={size}
      className={clsx('shrink-0 rounded-lg object-contain', className)}
      onError={() => setErrored(true)}
    />
  );
}
