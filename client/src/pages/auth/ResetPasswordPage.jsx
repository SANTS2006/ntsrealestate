import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSearchParams, useNavigate, useLocation, useParams, Link } from 'react-router-dom';
import { AuthLayout } from '../../layouts/AuthLayout.jsx';
import { Field } from '../../components/ui/Input.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { tenantAuthApi } from '../../api/tenantAuth.js';
import { useBranding } from '../../contexts/BrandingContext.jsx';
import { resetPasswordSchema } from '../../validations/auth.js';

// Handles both /:orgSlug/reset-password (forgot-password flow) and
// /:orgSlug/set-password (completing an invite) — both are the same
// backend action (POST /orgs/:orgSlug/auth/reset-password consuming a
// single-use token), just different copy depending on which link the user
// actually clicked.
export default function ResetPasswordPage() {
  const { orgSlug } = useParams();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const location = useLocation();
  const { branding } = useBranding();
  const isInvite = location.pathname.includes('/set-password');
  const [serverError, setServerError] = useState(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(resetPasswordSchema) });

  const onSubmit = async ({ newPassword }) => {
    setServerError(null);
    try {
      await tenantAuthApi.resetPassword(orgSlug, { token, newPassword });
      navigate(`/${orgSlug}/login`, { replace: true, state: { justReset: true } });
    } catch (err) {
      setServerError(err.details?.map((d) => d.message).join(' ') || err.message);
    }
  };

  if (!token) {
    return (
      <AuthLayout key="no-token" title={isInvite ? 'Set your password' : 'Reset your password'}>
        <Alert variant="error">This link is missing its token. Please use the link from your email.</Alert>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      key="form"
      title={isInvite ? 'Set your password' : 'Choose a new password'}
      description={isInvite ? `You've been invited to ${branding.name} — set a password to activate your account.` : undefined}
      footer={<Link to={`/${orgSlug}/login`} className="font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400">Back to sign in</Link>}
    >
      {serverError && <Alert variant="error" className="mb-4">{serverError}</Alert>}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <Field
          label="New password"
          type="password"
          placeholder="Enter new password"
          autoComplete="new-password"
          autoFocus
          glass
          hint="At least 12 characters, with uppercase, lowercase, and a number."
          error={errors.newPassword?.message}
          {...register('newPassword')}
        />
        <Field
          label="Confirm password"
          type="password"
          placeholder="Re-enter new password"
          autoComplete="new-password"
          glass
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />
        <Button type="submit" loading={isSubmitting} className="w-full">
          {isInvite ? 'Activate account' : 'Reset password'}
        </Button>
      </form>
    </AuthLayout>
  );
}
