import { useEffect } from 'react';
import { useBranding } from '../contexts/BrandingContext.jsx';

// Every page's title is suffixed with the current organization's own name
// (falling back to "NTS Real Estate System" wherever no tenant context
// applies — see contexts/BrandingContext.jsx) rather than a hardcoded
// brand — restores the previous title on unmount so a modal-like page
// transition never leaves a stale one.
export function useDocumentTitle(title) {
  const { branding } = useBranding();
  useEffect(() => {
    const previous = document.title;
    document.title = title ? `${title} — ${branding.name}` : branding.name;
    return () => { document.title = previous; };
  }, [title, branding.name]);
}
