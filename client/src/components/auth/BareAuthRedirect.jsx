import { Navigate, useLocation } from 'react-router-dom';
import { getLastOrgSlug } from '../../contexts/AuthContext.jsx';

// Auth links always carry their company's slug (/:orgSlug/login, …). A bare,
// slug-less one (an old bookmark, a hand-typed URL) is sent to the same page
// under the company this browser last used, query string and all, and only
// falls back to the neutral landing page when there is no such company —
// it never ends up on the platform admin pages.
export function BareAuthRedirect() {
  const { pathname, search } = useLocation();
  const slug = getLastOrgSlug();
  return <Navigate to={slug ? `/${slug}${pathname}${search}` : '/'} replace />;
}
