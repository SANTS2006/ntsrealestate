import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LayoutDashboard, Building2, ShieldCheck, ShieldOff, Users, Home, ArrowRight } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { StatCard } from '../../components/ui/StatCard.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { LoadingState } from '../../components/ui/Spinner.jsx';
import { usePlatformAdmin } from '../../contexts/PlatformAdminContext.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { platformAdminApi } from '../../api/platformAdmin.js';

export default function PlatformAdminOverviewPage() {
  useDocumentTitle('Overview — Platform Admin');
  const { admin } = usePlatformAdmin();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    platformAdminApi.overview()
      .then((res) => setData(res.data))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <>
      <PageHeader
        icon={LayoutDashboard}
        eyebrow="Platform"
        title={`Welcome${admin?.firstName ? `, ${admin.firstName}` : ''}`}
        description="A snapshot of every real estate company running on the platform."
      />

      {error && <Alert variant="error" className="mt-6">{error}</Alert>}
      {!data && !error && <div className="mt-8"><LoadingState label="Loading overview…" /></div>}

      {data && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
            <StatCard icon={Building2} label="Organizations" value={data.organizations.total} tone="brand" />
            <StatCard icon={ShieldCheck} label="Active" value={data.organizations.active} tone="success" />
            <StatCard icon={ShieldOff} label="Deactivated" value={data.organizations.suspended} tone={data.organizations.suspended ? 'danger' : 'neutral'} />
            <StatCard icon={Users} label="Users" value={data.users} tone="brand" subtext="across all organizations" />
            <StatCard icon={Home} label="Properties" value={data.properties} tone="brand" subtext="across all organizations" />
          </div>

          <div className="mt-8 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Recently added</h2>
              <Link to="/platform-admin/organizations" className="flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline dark:text-brand-400">
                All organizations <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>
            {data.recentOrganizations.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                No organizations yet. <Link to="/platform-admin/organizations" className="font-medium text-brand-600 hover:underline dark:text-brand-400">Add the first one.</Link>
              </p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.recentOrganizations.map((org) => (
                  <li key={org.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: org.primaryColor }} aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{org.name}</p>
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">/{org.slug} · added {new Date(org.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <Badge tone={org.status === 'active' ? 'success' : 'danger'}>{org.status === 'active' ? 'Active' : 'Deactivated'}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </>
  );
}
