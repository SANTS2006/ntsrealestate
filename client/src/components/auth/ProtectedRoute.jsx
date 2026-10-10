import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth, getLastOrgSlug } from '../../contexts/AuthContext.jsx';
import { LoadingState } from '../ui/Spinner.jsx';

// UX-only gate: it decides whether to *render* a route, never whether an
// action is *allowed* — every request it triggers is still independently
// authorized server-side (see navigation.js's identical caveat).
export function ProtectedRoute() {
  const { isAuthenticated, loading, authError, refreshUser } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <LoadingState label="Checking your session…" />
      </div>
    );
  }

  if (!isAuthenticated && authError) {
    return (
      <div role="alert" className="flex min-h-screen items-center justify-center bg-slate-50 p-6 dark:bg-slate-950">
        <div className="max-w-sm rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">We could not reach the server.</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Check your connection and try again. You have not been signed out.</p>
          <button type="button" onClick={refreshUser} className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">Try again</button>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // The dashboard routes carry no org slug of their own (the session
    // already knows the organization) — fall back to whichever tenant's
    // login this browser last used, or the neutral landing page if none
    // is remembered (e.g. a fresh browser, or storage disabled).
    const lastOrgSlug = getLastOrgSlug();
    return <Navigate to={lastOrgSlug ? `/${lastOrgSlug}/login` : '/'} replace state={{ from: location }} />;
  }

  return <Outlet />;
}
