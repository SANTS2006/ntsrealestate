import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { usePlatformAdmin } from '../../contexts/PlatformAdminContext.jsx';
import { LoadingState } from '../ui/Spinner.jsx';

export function PlatformAdminProtectedRoute() {
  const { isAuthenticated, loading } = usePlatformAdmin();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <LoadingState label="Checking your session…" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/platform-admin/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
