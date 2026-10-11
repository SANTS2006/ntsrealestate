import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { UserCog, Camera, Trash2 } from 'lucide-react';
import { AdminAvatar } from '../../components/platformAdmin/AdminAvatar.jsx';
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

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

function PictureCard() {
  const { admin, refresh } = usePlatformAdmin();
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(null);
  const [message, setMessage] = useState(null);

  const choose = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setMessage({ variant: 'error', text: 'Use a JPEG, PNG or WebP image.' }); return; }
    if (file.size > MAX_AVATAR_BYTES) { setMessage({ variant: 'error', text: 'The image is too large. The limit is 2 MB.' }); return; }
    setBusy('upload'); setMessage(null);
    try {
      await platformAdminApi.uploadAvatar(file);
      await refresh();
      setMessage({ variant: 'success', text: 'Profile picture updated.' });
    } catch (err) {
      setMessage({ variant: 'error', text: err.message });
    } finally { setBusy(null); }
  };

  const remove = async () => {
    setBusy('remove'); setMessage(null);
    try {
      await platformAdminApi.removeAvatar();
      await refresh();
      setMessage({ variant: 'success', text: 'Profile picture removed.' });
    } catch (err) {
      setMessage({ variant: 'error', text: err.message });
    } finally { setBusy(null); }
  };

  return (
    <Card>
      <CardHeader><h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Profile picture</h2></CardHeader>
      <CardBody>
        {message && <Alert variant={message.variant} className="mb-4">{message.text}</Alert>}
        <div className="flex flex-wrap items-center gap-5">
          <AdminAvatar admin={admin} size={96} />
          <div className="flex flex-col gap-2">
            <p className="text-sm text-slate-500 dark:text-slate-400">JPEG, PNG or WebP, up to 2 MB. A square photo works best.</p>
            <div className="flex flex-wrap gap-2">
              <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={choose} />
              <Button type="button" onClick={() => inputRef.current?.click()} loading={busy === 'upload'}>
                <Camera size={15} aria-hidden="true" />
                {admin?.avatarUpdatedAt ? 'Change picture' : 'Upload picture'}
              </Button>
              {admin?.avatarUpdatedAt && (
                <Button type="button" variant="secondary" onClick={remove} loading={busy === 'remove'}>
                  <Trash2 size={15} aria-hidden="true" />
                  Remove
                </Button>
              )}
            </div>
          </div>
        </div>
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
        <PictureCard />
        <ProfileCard />
        <PasswordCard />
      </div>
    </>
  );
}
