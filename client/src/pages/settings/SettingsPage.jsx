import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { UserCircle, Building2, LogOut, Share2 } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { ChangePasswordForm } from '../../components/settings/ChangePasswordForm.jsx';
import { MfaSection } from '../../components/settings/MfaSection.jsx';
import { OrganizationForm } from '../../components/settings/OrganizationForm.jsx';
import { ProfilePictureCard } from '../../components/settings/ProfilePictureCard.jsx';
import { authApi } from '../../api/auth.js';
import { useAuth, getLoginPath } from '../../contexts/AuthContext.jsx';
import { ShareSystemCard } from '../../components/settings/ShareSystemCard.jsx';
import { CAN_MANAGE_ORGANIZATION, CAN_VIEW_ORGANIZATION, canAny } from '../../config/capabilities.js';

function AccountTab() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [signOutError, setSignOutError] = useState(null);
  const [signOutBusy, setSignOutBusy] = useState(false);

  const handleSignOutAll = async () => {
    setSignOutError(null);
    setSignOutBusy(true);
    try {
      await authApi.logoutAll();
      await logout();
      navigate(getLoginPath(), { replace: true });
    } catch (err) {
      setSignOutError(err.message);
    } finally {
      setSignOutBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <ProfilePictureCard />

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Profile</h2>
        </CardHeader>
        <CardBody className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500 dark:text-slate-400">Name</dt>
            <dd className="text-slate-900 dark:text-slate-100">{user?.firstName} {user?.lastName}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-slate-500 dark:text-slate-400">Email</dt>
            <dd className="break-words text-slate-900 dark:text-slate-100">{user?.email}</dd>
          </div>
          <div>
            <dt className="text-slate-500 dark:text-slate-400">Role</dt>
            <dd className="capitalize text-slate-900 dark:text-slate-100">{(user?.roles ?? []).join(', ').replace(/_/g, ' ')}</dd>
          </div>
        </CardBody>
      </Card>

      <ChangePasswordForm />
      <MfaSection />

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Sessions</h2>
        </CardHeader>
        <CardBody className="flex flex-col gap-3">
          {signOutError && <Alert variant="error">{signOutError}</Alert>}
          <p className="text-sm text-slate-500 dark:text-slate-400">Sign out everywhere if you suspect your account was accessed from a device you don't recognize.</p>
          <div>
            <Button variant="danger" onClick={handleSignOutAll} loading={signOutBusy}>
              <LogOut size={15} aria-hidden="true" />
              Sign out of all devices
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  const canViewOrg = canAny(roles, CAN_VIEW_ORGANIZATION);
  const canManageOrg = canAny(roles, CAN_MANAGE_ORGANIZATION);
  const [tab, setTab] = useState('account');

  const tabs = [
    { id: 'account', label: 'Account', icon: UserCircle },
    ...(canViewOrg ? [{ id: 'organization', label: 'Organization', icon: Building2 }] : []),
    ...(canManageOrg ? [{ id: 'share', label: 'Share & QR', icon: Share2 }] : []),
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-800">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={clsx(
              'flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
              tab === t.id
                ? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            )}
          >
            <t.icon size={15} aria-hidden="true" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'account' && <AccountTab />}
      {tab === 'organization' && canViewOrg && <OrganizationForm canManage={canManageOrg} />}
      {tab === 'share' && canManageOrg && <ShareSystemCard />}
    </div>
  );
}
