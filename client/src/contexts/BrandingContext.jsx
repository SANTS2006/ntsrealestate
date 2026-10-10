import { createContext, useContext, useCallback, useEffect, useState, useMemo } from 'react';
import { organizationsApi } from '../api/organizations.js';
import { applyColorRamp } from '../utils/colorRamp.js';
import { useAuth, rememberOrgSlug } from './AuthContext.jsx';

const BrandingContext = createContext(null);

const PLATFORM_BRANDING = { name: 'NTS Real Estate System', logoUrl: '/logo-nts.png' };

// Two independent sources feed this, never both at once:
//  - Pre-auth: a tenant's own login/register/forgot/reset pages call
//    `applyTenantBranding` (see layouts/AuthLayout.jsx) after fetching
//    GET /orgs/:orgSlug/branding — anonymous, so it has to be pushed in
//    explicitly rather than fetched here.
//  - Post-auth: once `useAuth()` reports a signed-in user, this fetches the
//    caller's own organization's branding automatically (GET
//    /organizations/me/branding) and applies it for the whole dashboard.
// Either way, "applying" means computing a full 50–950 tint/shade ramp from
// the tenant's two colors and writing it as CSS custom properties (see
// utils/colorRamp.js) — every `bg-brand-600`/`text-accent-400`/etc. class
// already used throughout the app picks it up with no component changes.
// Falls back to the platform's own NTS identity whenever no tenant context
// applies (platform-admin pages, or before either fetch above resolves).
export function BrandingProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [tenantBranding, setTenantBranding] = useState(null);
  const [dashboardBranding, setDashboardBranding] = useState(null);

  const applyTenantBranding = useCallback((branding) => {
    setTenantBranding(branding);
    if (branding?.primaryColor) applyColorRamp('brand', branding.primaryColor);
    if (branding?.secondaryColor) applyColorRamp('accent', branding.secondaryColor);
  }, []);

  // Platform-admin pages have no tenant context, yet a tenant user may still
  // be signed in (or a tenant login page visited earlier in this SPA session),
  // so those pages switch this on while mounted: the platform identity wins
  // and the inline color overrides are removed so index.css defaults apply.
  const [platformMode, setPlatformMode] = useState(false);
  const enterPlatformMode = useCallback(() => setPlatformMode(true), []);
  const leavePlatformMode = useCallback(() => setPlatformMode(false), []);

  useEffect(() => {
    if (!isAuthenticated) {
      setDashboardBranding(null);
      return;
    }
    organizationsApi.getMyBranding()
      .then((res) => {
        setDashboardBranding(res.data);
        // Keeps "which company is this browser on" current even when the
        // session was restored rather than freshly signed in.
        if (res.data.slug) rememberOrgSlug(res.data.slug);
      })
      .catch(() => {});
  }, [isAuthenticated]);

  useEffect(() => {
    if (platformMode) {
      for (const prefix of ['brand', 'accent']) {
        for (const stop of [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]) {
          document.documentElement.style.removeProperty(`--color-${prefix}-${stop}`);
        }
      }
    } else if (dashboardBranding) {
      applyColorRamp('brand', dashboardBranding.primaryColor);
      applyColorRamp('accent', dashboardBranding.secondaryColor);
    }
  }, [platformMode, dashboardBranding]);

  const branding = platformMode ? PLATFORM_BRANDING : (dashboardBranding ?? tenantBranding ?? PLATFORM_BRANDING);

  // The browser tab / taskbar / home-screen icon is the organization's own
  // logo (the one the platform admin uploaded), or the platform's when no
  // organization applies.
  const logoUrl = branding?.logoUrl;
  useEffect(() => {
    if (!logoUrl) return undefined;
    const setIcon = (rel, href, type) => {
      let link = document.querySelector(`link[rel="${rel}"]`);
      if (!link) {
        link = document.createElement('link');
        link.rel = rel;
        document.head.appendChild(link);
      }
      if (type) link.type = type; else link.removeAttribute('type');
      link.href = href;
    };
    setIcon('apple-touch-icon', logoUrl);
    // The tab icon gets rounded corners on all four sides: the platform's own
    // is a ready-made rounded PNG; an organization's logo is drawn onto a
    // rounded square (falling back to the plain logo if the browser will not
    // let us read the image).
    if (logoUrl === PLATFORM_BRANDING.logoUrl) {
      setIcon('icon', '/favicon.png', 'image/png');
      return undefined;
    }
    setIcon('icon', logoUrl);
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (cancelled) return;
      try {
        const size = 64;
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d');
        const r = size * 0.225;
        ctx.beginPath();
        ctx.roundRect(0, 0, size, size, r);
        ctx.clip();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, size, size);
        const pad = size * 0.08;
        const scale = Math.min((size - pad * 2) / img.width, (size - pad * 2) / img.height);
        ctx.drawImage(img, (size - img.width * scale) / 2, (size - img.height * scale) / 2, img.width * scale, img.height * scale);
        setIcon('icon', canvas.toDataURL('image/png'), 'image/png');
      } catch {
        // cross-origin image: keep the plain logo
      }
    };
    img.src = logoUrl;
    return () => { cancelled = true; };
  }, [logoUrl]);

  const value = useMemo(
    () => ({ branding, applyTenantBranding, enterPlatformMode, leavePlatformMode }),
    [branding, applyTenantBranding, enterPlatformMode, leavePlatformMode],
  );

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useBranding() {
  const ctx = useContext(BrandingContext);
  if (!ctx) throw new Error('useBranding must be used within a BrandingProvider');
  return ctx;
}

// Same as useBranding but returns null outside a BrandingProvider (e.g. a
// loader shown before the providers mount).
export function useOptionalBranding() {
  return useContext(BrandingContext);
}
