import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { UserCog } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { Card, CardHeader, CardBody } from '../../components/ui/Card.jsx';
import { Field } from '../../components/ui/Input.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { usePlatformAdmin } from '../../contexts/PlatformAdminContext.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { platformAdminApi } from '../../api/platformAdmin.js';

const profileSchema = z.object({
  firstName: z.string().trim().min(1, 'Enter your first name.'),
  lastName: z.string().trim().min(1, 'Enter your last name.'),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password.'),
  newPassword: z.string().min(12, 'Password must be at least 12 characters.'),
  confirmPassword: z.string(),
}).refine((v) => v.newPassword === v.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match.' });

function ProfileCard() {
  const { admin, refresh } = usePlatformAdmin();
  const [message, setMessage] = useState(null); // { variant, text }
  const { register, handleSubmit, reset, formState: { errors, isSubmitting, isDirty } } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: { firstName: admin?.firstName ?? '', lastName: admin?.lastName ?? '' },
  });

  const onSubmit = async (body) => {
    setMessage(null);
    try {
      await platformAdminApi.updateProfile(body);
      await refresh();
      reset(body);
      setMessage({ variant: 'success', text: 'Profile updated.' });
    } catch (err) {
      setMessage({ variant: 'error', text: err.details?.map((d) => d.message).join(' ') || err.message });
    }
  };

  return (
    <Card>
      <CardHeader><h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Profile</h2></CardHeader>
      <CardBody>
        {message && <Alert variant={message.variant} className="mb-4">{message.text}</Alert>}
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="First name" error={errors.firstName?.message} {...register('firstName')} />
            <Field label="Last name" error={errors.lastName?.message} {...register('lastName')} />
          </div>
          <Field label="Email address" value={admin?.email ?? ''} disabled readOnly hint="Your sign-in email can't be changed here." />
          <div><Button type="submit" loading={isSubmitting} disabled={!isDirty}>Save profile</Button></div>
        </form>
      </CardBody>
    </Card>
  );
}

function PasswordCard() {
  const [message, setMessage] = useState(null);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(passwordSchema) });

  const onSubmit = async ({ currentPassword, newPassword }) => {
    setMessage(null);
    try {
      await platformAdminApi.changePassword({ currentPassword, newPassword });
      reset();
      setMessage({ variant: 'success', text: 'Password changed.' });
    } catch (err) {
      setMessage({ variant: 'error', text: err.details?.map((d) => d.message).join(' ') || err.message });
    }
  };

  return (
    <Card>
      <CardHeader><h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Change password</h2></CardHeader>
      <CardBody>
        {message && <Alert variant={message.variant} className="mb-4">{message.text}</Alert>}
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <Field label="Current password" type="password" autoComplete="current-password" error={errors.currentPassword?.message} {...register('currentPassword')} />
          <Field
            label="New password" type="password" autoComplete="new-password"
            hint="At least 12 characters, with uppercase, lowercase, and a number."
            error={errors.newPassword?.message} {...register('newPassword')}
          />
          <Field label="Confirm new password" type="password" autoComplete="new-password" error={errors.confirmPassword?.message} {...register('confirmPassword')} />
          <div><Button type="submit" loading={isSubmitting}>Change password</Button></div>
        </form>
      </CardBody>
    </Card>
  );
}

export default function PlatformAdminAccountPage() {
  useDocumentTitle('My account — Platform Admin');
  return (
    <>
      <PageHeader icon={UserCog} eyebrow="Platform" title="My account" description="Your profile and sign-in security." />
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ProfileCard />
        <PasswordCard />
      </div>
    </>
  );
}
