import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useParams } from 'react-router-dom';
import { AuthLayout } from '../../layouts/AuthLayout.jsx';
import { Field } from '../../components/ui/Input.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { tenantAuthApi } from '../../api/tenantAuth.js';
import { forgotPasswordSchema } from '../../validations/auth.js';

export default function ForgotPasswordPage() {
  const { orgSlug } = useParams();
  const [sent, setSent] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(forgotPasswordSchema) });

  const onSubmit = async ({ email }) => {
    // The API always returns the same generic response whether or not the
    // email exists (anti-enumeration) — this screen mirrors that by always
    // showing the "sent" state, never revealing account existence either.
    await tenantAuthApi.forgotPassword(orgSlug, email).catch(() => {});
    setSent(true);
  };

  if (sent) {
    return (
      <AuthLayout key="sent" title="Check your email" footer={<Link to={`/${orgSlug}/login`} className="font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400">Back to sign in</Link>}>
        <Alert variant="success">If an account with that email exists, a password reset link has been sent.</Alert>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      key="form"
      title="Reset your password"
      description="Enter your email address and we'll send you a link to reset your password."
      footer={<Link to={`/${orgSlug}/login`} className="font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400">Back to sign in</Link>}
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <Field label="Email address" type="email" placeholder="Enter your email" autoComplete="email" autoFocus glass error={errors.email?.message} {...register('email')} />
        <Button type="submit" loading={isSubmitting} className="w-full">
          Send reset link
        </Button>
      </form>
    </AuthLayout>
  );
}
