import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import { Field } from '../../components/ui/Input.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { PlatformAuthShell } from '../../components/platformAdmin/PlatformAuthShell.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { platformAdminApi } from '../../api/platformAdmin.js';

const schema = z.object({
  email: z.string().trim().min(1, 'Email is required.').email('Enter a valid email address.'),
});

const backLink = (
  <Link to="/platform-admin/login" className="font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400">
    Back to sign in
  </Link>
);

export default function PlatformAdminForgotPasswordPage() {
  useDocumentTitle('Forgot password — Platform Admin');
  const [sent, setSent] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async ({ email }) => {
    // The API gives the same generic answer whether or not the account
    // exists; this screen mirrors that so it never reveals who has one.
    await platformAdminApi.forgotPassword(email).catch(() => {});
    setSent(true);
  };

  if (sent) {
    return (
      <PlatformAuthShell title="Check your email" footer={backLink}>
        <Alert variant="success">If a platform admin account with that email exists, a password reset link has been sent. It expires in 15 minutes.</Alert>
      </PlatformAuthShell>
    );
  }

  return (
    <PlatformAuthShell title="Forgot password" subtitle="We will email you a link to reset it" footer={backLink}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <Field label="Email address" type="email" placeholder="Enter your email" autoComplete="email" autoFocus glass error={errors.email?.message} {...register('email')} />
        <Button type="submit" loading={isSubmitting} className="w-full mt-2">Send reset link</Button>
      </form>
    </PlatformAuthShell>
  );
}
