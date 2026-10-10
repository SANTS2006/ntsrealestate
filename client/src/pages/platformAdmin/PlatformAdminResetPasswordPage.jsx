import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Field } from '../../components/ui/Input.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { PlatformAuthShell } from '../../components/platformAdmin/PlatformAuthShell.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { platformAdminApi } from '../../api/platformAdmin.js';

const schema = z.object({
  newPassword: z.string().min(12, 'Password must be at least 12 characters.'),
  confirmPassword: z.string(),
}).refine((v) => v.newPassword === v.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match.' });

const backLink = (
  <Link to="/platform-admin/login" className="font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400">
    Back to sign in
  </Link>
);

// Also the landing page for a new platform admin's invite email — the same
// token mechanism, just issued with a longer lifetime.
export default function PlatformAdminResetPasswordPage() {
  useDocumentTitle('Reset password — Platform Admin');
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const [serverError, setServerError] = useState(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async ({ newPassword }) => {
    setServerError(null);
    try {
      await platformAdminApi.resetPassword({ token, password: newPassword });
      navigate('/platform-admin/login', { replace: true, state: { justReset: true } });
    } catch (err) {
      setServerError(err.details?.map((d) => d.message).join(' ') || err.message);
    }
  };

  if (!token) {
    return (
      <PlatformAuthShell title="Reset password" footer={backLink}>
        <Alert variant="error">This link is missing its token. Please use the link from your email.</Alert>
      </PlatformAuthShell>
    );
  }

  return (
    <PlatformAuthShell title="Choose a new password" subtitle="For your platform admin account" footer={backLink}>
      {serverError && <Alert variant="error" className="mb-4">{serverError}</Alert>}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <Field
          label="New password" type="password" placeholder="Enter new password" autoComplete="new-password" autoFocus glass
          hint="At least 12 characters, with uppercase, lowercase, and a number."
          error={errors.newPassword?.message} {...register('newPassword')}
        />
        <Field label="Confirm password" type="password" placeholder="Re-enter new password" autoComplete="new-password" glass error={errors.confirmPassword?.message} {...register('confirmPassword')} />
        <Button type="submit" loading={isSubmitting} className="w-full mt-2">Reset password</Button>
      </form>
    </PlatformAuthShell>
  );
}
