import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardHeader, CardBody } from '../ui/Card.jsx';
import { Field } from '../ui/Input.jsx';
import { Button } from '../ui/Button.jsx';
import { Alert } from '../ui/Alert.jsx';
import { authApi } from '../../api/auth.js';
import { changePasswordFormSchema } from '../../validations/account.js';

export function ChangePasswordForm() {
  const [serverError, setServerError] = useState(null);
  const [success, setSuccess] = useState(false);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(changePasswordFormSchema) });

  const onSubmit = async (values) => {
    setServerError(null);
    setSuccess(false);
    try {
      await authApi.changePassword({ currentPassword: values.currentPassword, newPassword: values.newPassword });
      setSuccess(true);
      reset({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setServerError(err.details?.map((d) => d.message).join(' ') || err.message);
    }
  };

  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Change password</h2>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">Changing your password signs you out on every other device.</p>
      </CardHeader>
      <CardBody>
        {success && <Alert variant="success" className="mb-4">Password changed successfully.</Alert>}
        {serverError && <Alert variant="error" className="mb-4">{serverError}</Alert>}
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <Field label="Current password" type="password" autoComplete="current-password" required error={errors.currentPassword?.message} {...register('currentPassword')} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="New password"
              type="password"
              autoComplete="new-password"
              required
              hint="At least 12 characters."
              error={errors.newPassword?.message}
              {...register('newPassword')}
            />
            <Field label="Confirm new password" type="password" autoComplete="new-password" required error={errors.confirmPassword?.message} {...register('confirmPassword')} />
          </div>
          <div>
            <Button type="submit" loading={isSubmitting}>Change password</Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
