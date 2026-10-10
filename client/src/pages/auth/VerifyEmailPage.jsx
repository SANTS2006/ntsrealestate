import { useEffect, useState } from 'react';
import { useSearchParams, useParams, Link } from 'react-router-dom';
import { CheckCircle2, XCircle } from 'lucide-react';
import { AuthLayout } from '../../layouts/AuthLayout.jsx';
import { LoadingState } from '../../components/ui/Spinner.jsx';
import { authApi } from '../../api/auth.js';

export default function VerifyEmailPage() {
  const { orgSlug } = useParams();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState('verifying'); // 'verifying' | 'success' | 'error'
  const [errorMessage, setErrorMessage] = useState(null);
  // The server reports which company the verified account belongs to, so
  // the sign-in link is right even if this page was opened under a
  // different slug than the account's own.
  const [accountSlug, setAccountSlug] = useState(null);
  const loginSlug = accountSlug ?? orgSlug;

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMessage('This verification link is missing its token.');
      return;
    }
    authApi.verifyEmail(token)
      .then((res) => {
        setAccountSlug(res?.data?.orgSlug ?? null);
        setStatus('success');
      })
      .catch((err) => {
        setStatus('error');
        setErrorMessage(err.message);
      });
  }, [token]);

  return (
    <AuthLayout title="Email verification">
      {status === 'verifying' && <LoadingState label="Verifying your email…" />}

      {status === 'success' && (
        <div className="flex flex-col items-center gap-4 text-center">
          <CheckCircle2 size={40} className="text-emerald-500" aria-hidden="true" />
          <p className="text-sm text-slate-600 dark:text-slate-400">Your email address has been verified. You can now sign in.</p>
          <Link to={`/${loginSlug}/login`} className="text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400">
            Continue to sign in
          </Link>
        </div>
      )}

      {status === 'error' && (
        <div className="flex flex-col items-center gap-4 text-center">
          <XCircle size={40} className="text-rose-500" aria-hidden="true" />
          <p className="text-sm text-slate-600 dark:text-slate-400">{errorMessage}</p>
          <Link to={`/${orgSlug}/login`} className="text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400">
            Back to sign in
          </Link>
        </div>
      )}
    </AuthLayout>
  );
}
