import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, LayoutDashboard, LogIn, Mail } from 'lucide-react';
import { NotFoundScreen, PRIMARY_ACTION, SECONDARY_ACTION } from '../components/notFound/NotFoundScreen.jsx';
import { useAuth, getLastOrgSlug } from '../contexts/AuthContext.jsx';
import { useBranding } from '../contexts/BrandingContext.jsx';
import { usePlatformAdmin } from '../contexts/PlatformAdminContext.jsx';
import { tenantAuthApi } from '../api/tenantAuth.js';
import { organizationsApi } from '../api/organizations.js';
import { classifyPath } from '../utils/notFound.js';

const PLATFORM = { name: 'NTS Real Estate System', logo: '/logo-nts.png' };

// While mounted, the platform's own identity applies, even if a company user is
// signed in or a company's sign-in page was visited earlier.
function usePlatformIdentity() {
  const { enterPlatformMode, leavePlatformMode } = useBranding();
  useEffect(() => {
    enterPlatformMode();
    return leavePlatformMode;
  }, [enterPlatformMode, leavePlatformMode]);
}

const Blank = () => <div className="h-screen bg-slate-50 dark:bg-slate-950" />;

// The main system's 404. "/" and "/contact" are the public website, which the
// server renders, so they are ordinary links (full page loads), not app routes.
export function MainNotFound({ path, title = 'Page not found', message }) {
  usePlatformIdentity();
  return (
    <NotFoundScreen
      brandName={PLATFORM.name}
      logoUrl={PLATFORM.logo}
      title={title}
      message={message ?? "The page you're looking for doesn't exist or has moved. Check the address, or head back home."}
      path={path}
    >
      <a href="/" className={PRIMARY_ACTION}><Home size={16} aria-hidden="true" /> Back to home</a>
      <a href="/contact" className={SECONDARY_ACTION}><Mail size={16} aria-hidden="true" /> Contact us</a>
    </NotFoundScreen>
  );
}

function PlatformNotFound({ path }) {
  usePlatformIdentity();
  const { isAuthenticated, loading } = usePlatformAdmin();
  if (loading) return <Blank />;
  return (
    <NotFoundScreen
      brandName={PLATFORM.name}
      logoUrl={PLATFORM.logo}
      title="This console page doesn't exist"
      message="There's nothing at this address in the platform console."
      path={path}
    >
      {isAuthenticated
        ? <Link to="/platform-admin" className={PRIMARY_ACTION}><LayoutDashboard size={16} aria-hidden="true" /> Go to the console</Link>
        : <a href="/" className={PRIMARY_ACTION}><Home size={16} aria-hidden="true" /> Back to home</a>}
    </NotFoundScreen>
  );
}

function CompanyScreen({ company, path, signedInHere }) {
  return (
    <NotFoundScreen
      brandName={company.name}
      logoUrl={company.logoUrl}
      colors={{ primary: company.primaryColor, secondary: company.secondaryColor }}
      title="Page not found"
      message={`We couldn't find that page at ${company.name}. It may have moved, or the address may be mistyped.`}
      path={path}
    >
      {signedInHere
        ? <Link to="/dashboard" className={PRIMARY_ACTION}><LayoutDashboard size={16} aria-hidden="true" /> Go to dashboard</Link>
        : company.slug && <Link to={`/${company.slug}/login`} className={PRIMARY_ACTION}><LogIn size={16} aria-hidden="true" /> Go to sign in</Link>}
    </NotFoundScreen>
  );
}

// Which company, if any, this address belongs to:
//  - /<company>/...      that company, if it exists
//  - an app page, or an address naming no company, while signed in: your own company
//  - an app page while signed out: the company this browser last used
//  - otherwise the main system's 404
async function resolveCompany(route, isAuthenticated) {
  const orNull = (request) => request.then((res) => res.data).catch(() => null);
  const slug = route.area === 'company' ? route.slug : (!isAuthenticated ? getLastOrgSlug() : null);
  // Asked for directly rather than read from BrandingContext, which may not have loaded yet.
  const [named, own] = await Promise.all([
    slug ? orNull(tenantAuthApi.getBranding(slug)) : null,
    isAuthenticated ? orNull(organizationsApi.getMyBranding()) : null,
  ]);
  if (named) {
    return { company: { ...named, slug }, signedInHere: own?.slug?.toLowerCase() === slug.toLowerCase() };
  }
  return own ? { company: own, signedInHere: true } : { company: null, signedInHere: false };
}

function CompanyNotFound({ route, path }) {
  const { isAuthenticated } = useAuth();
  const [result, setResult] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setResult(null);
    resolveCompany({ area: route.area, slug: route.slug }, isAuthenticated)
      .then((next) => { if (!cancelled) setResult(next); });
    return () => { cancelled = true; };
  }, [route.area, route.slug, isAuthenticated]);

  if (!result) return <Blank />;
  if (result.company) return <CompanyScreen company={result.company} path={path} signedInHere={result.signedInHere} />;
  return <MainNotFound path={path} />;
}

export default function NotFoundPage() {
  const { pathname } = useLocation();
  const { loading } = useAuth();
  const route = classifyPath(pathname);

  if (route.area === 'platform') return <PlatformNotFound path={pathname} />;
  if (route.area === 'main') return <MainNotFound path={pathname} />;
  if (loading) return <Blank />;
  return <CompanyNotFound route={route} path={pathname} />;
}
