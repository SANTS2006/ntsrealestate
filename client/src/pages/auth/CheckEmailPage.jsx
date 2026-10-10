import { useState } from 'react';
import { useLocation, useParams, Link } from 'react-router-dom';
import { MailCheck } from 'lucide-react';
import { AuthLayout } from '../../layouts/AuthLayout.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { authApi } from '../../api/auth.js';

// Landed on after registration (or "resend verification") — the email
// itself is never confirmed to exist or not from this screen (anti-
// enumeration carries through from the API's generic response).
export default function CheckEmailPage() {
  const { orgSlug } = useParams();
  const location = useLocation();
  const email = location.state?.email;
  const [resent, setResent] = useState(false);
  const [loading, setLoading] = useState(false);

  const resend = async () => {
    if (!email) return;
    setLoading(true);
    try {
      await authApi.resendVerification(email);
      setResent(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Check your email"
      footer={
        <Link to={`/${orgSlug}/login`} className="font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400">
          Back to sign in
        </Link>
      }
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
          <MailCheck size={24} aria-hidden="true" />
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {email
            ? <>We've sent a verification link to <span className="font-medium text-slate-900 dark:text-slate-100">{email}</span>. Click it to activate your account.</>
            : 'We\'ve sent a verification link to your email address. Click it to activate your account.'}
        </p>
        {resent && <Alert variant="success">A new verification link has been sent.</Alert>}
        {email && (
          <Button variant="secondary" onClick={resend} loading={loading} disabled={resent}>
            Resend verification email
          </Button>
        )}
      </div>
    </AuthLayout>
  );
}
