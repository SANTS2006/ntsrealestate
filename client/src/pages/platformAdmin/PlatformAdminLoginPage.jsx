import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Field } from '../../components/ui/Input.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { PlatformAuthShell } from '../../components/platformAdmin/PlatformAuthShell.jsx';
import { usePlatformAdmin } from '../../contexts/PlatformAdminContext.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';

const schema = z.object({
  email: z.string().trim().min(1, 'Email is required.').email('Enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
});

const codeSchema = z.object({ code: z.string().trim().min(6, 'Enter the 6-digit code, or a recovery code.').max(11) });

export default function PlatformAdminLoginPage() {
  useDocumentTitle('Platform Admin');
  const { login, completeMfa } = usePlatformAdmin();
  const [mfaToken, setMfaToken] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) });
  const codeForm = useForm({ resolver: zodResolver(codeSchema) });

  const redirectTo = location.state?.from ?? '/platform-admin';

  const onSubmit = async (body) => {
    setServerError(null);
    try {
      const result = await login(body.email, body.password);
      if (result.mfaRequired) { setMfaToken(result.mfaToken); return; }
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setServerError(err.message);
    }
  };

  const onSubmitCode = async ({ code }) => {
    setServerError(null);
    try {
      await completeMfa(mfaToken, code.trim());
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setServerError(err.message);
      // An expired ticket means starting again from the password.
      if (err.statusCode === 401 && /expired|start again/i.test(err.message)) setMfaToken(null);
    }
  };

  if (mfaToken) {
    return (
      <PlatformAuthShell title="Two-factor verification" subtitle="Enter the 6-digit code from your authenticator app, or one of your recovery codes.">
        {serverError && <Alert variant="error" className="mb-4">{serverError}</Alert>}
        <form onSubmit={codeForm.handleSubmit(onSubmitCode)} noValidate className="flex flex-col gap-4">
          <Field label="Verification code" placeholder="123456" inputMode="text" autoComplete="one-time-code" autoFocus glass error={codeForm.formState.errors.code?.message} {...codeForm.register('code')} />
          <Button type="submit" loading={codeForm.formState.isSubmitting} className="w-full mt-2">Verify and sign in</Button>
          <button type="button" onClick={() => { setMfaToken(null); setServerError(null); }} className="text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400">Back to sign in</button>
        </form>
      </PlatformAuthShell>
    );
  }

  return (
    <PlatformAuthShell title="Platform Admin">
      {location.state?.justReset && <Alert variant="success" className="mb-4">Password updated. Sign in with your new password.</Alert>}
      {serverError && <Alert variant="error" className="mb-4">{serverError}</Alert>}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <Field label="Email address" type="email" placeholder="Enter your email" autoComplete="email" autoFocus glass error={errors.email?.message} {...register('email')} />
        <div>
          <Field label="Password" type="password" placeholder="Enter your password" autoComplete="current-password" glass error={errors.password?.message} {...register('password')} />
          <div className="mt-2 text-right">
            <Link to="/platform-admin/forgot-password" className="text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400">
              Forgot password?
            </Link>
          </div>
        </div>
        <Button type="submit" loading={isSubmitting} className="w-full mt-2">Sign in</Button>
      </form>
    </PlatformAuthShell>
  );
}
