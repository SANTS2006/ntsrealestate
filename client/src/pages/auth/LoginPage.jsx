import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '../../layouts/AuthLayout.jsx';
import { Field } from '../../components/ui/Input.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { getRentIntent, rentPath } from '../../utils/rentIntent.js';
import { loginSchema, mfaCodeSchema } from '../../validations/auth.js';

export default function LoginPage() {
  const { orgSlug } = useParams();
  const { login, completeMfaChallenge } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState('credentials'); // 'credentials' | 'mfa'
  const [mfaToken, setMfaToken] = useState(null);
  const [serverError, setServerError] = useState(null);

  const credentialsForm = useForm({ resolver: zodResolver(loginSchema) });
  const mfaForm = useForm({ resolver: zodResolver(mfaCodeSchema) });

  // `?next=/inspections` comes from deep links in emails; only same-site
  // absolute paths are honored so it can't be used as an open redirect.
  const next = searchParams.get('next');
  const safeNext = next && /^\/(?!\/)/.test(next) ? next : null;
  // Someone who came from "rent this property" on the company website goes
  // straight back to that request once signed in.
  const rentIntent = getRentIntent(orgSlug);
  const redirectTo = location.state?.from ?? (rentIntent ? rentPath(rentIntent) : null) ?? safeNext ?? '/home';

  const onSubmitCredentials = async ({ email, password }) => {
    setServerError(null);
    try {
      const result = await login(orgSlug, email, password);
      if (result.mfaRequired) {
        setMfaToken(result.mfaToken);
        setStep('mfa');
      } else {
        navigate(redirectTo, { replace: true });
      }
    } catch (err) {
      setServerError(err.message);
    }
  };

  const onSubmitMfa = async ({ code }) => {
    setServerError(null);
    try {
      await completeMfaChallenge(orgSlug, mfaToken, code);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setServerError(err.message);
    }
  };

  if (step === 'mfa') {
    return (
      <AuthLayout key="mfa" title="Two-factor verification" description="Enter the 6-digit code from your authenticator app, or a recovery code.">
        {serverError && <Alert variant="error" className="mb-4">{serverError}</Alert>}
        <form onSubmit={mfaForm.handleSubmit(onSubmitMfa)} noValidate className="flex flex-col gap-4">
          <Field
            label="Authentication code"
            placeholder="123456"
            autoComplete="one-time-code"
            autoFocus
            glass
            error={mfaForm.formState.errors.code?.message}
            {...mfaForm.register('code')}
          />
          <Button type="submit" loading={mfaForm.formState.isSubmitting} className="w-full">
            Verify
          </Button>
          <button
            type="button"
            onClick={() => { setStep('credentials'); setServerError(null); }}
            className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            Back to sign in
          </button>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      key="credentials"
      title="Login"
    >
      {serverError && <Alert variant="error" className="mb-4">{serverError}</Alert>}
      <form onSubmit={credentialsForm.handleSubmit(onSubmitCredentials)} noValidate className="flex flex-col gap-4">
        <Field
          label="Email address"
          type="email"
          placeholder="Enter your email"
          autoComplete="email"
          autoFocus
          glass
          error={credentialsForm.formState.errors.email?.message}
          {...credentialsForm.register('email')}
        />
        <div>
          <Field
            label="Password"
            type="password"
            placeholder="Enter your password"
            autoComplete="current-password"
            glass
            error={credentialsForm.formState.errors.password?.message}
            {...credentialsForm.register('password')}
          />
          <div className="mt-1.5 text-right">
            <Link to={`/${orgSlug}/forgot-password`} className="text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400">
              Forgot password?
            </Link>
          </div>
        </div>
        <Button type="submit" loading={credentialsForm.formState.isSubmitting} className="w-full">
          Login
        </Button>
      </form>
    </AuthLayout>
  );
}
