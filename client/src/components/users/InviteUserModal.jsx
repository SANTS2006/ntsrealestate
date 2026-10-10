import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '../ui/Modal.jsx';
import { Field, SelectField } from '../ui/Input.jsx';
import { Button } from '../ui/Button.jsx';
import { Alert } from '../ui/Alert.jsx';
import { usersApi } from '../../api/users.js';
import { rolesApi } from '../../api/roles.js';
import { inviteUserFormSchema } from '../../validations/user.js';

export function InviteUserModal({ open, onClose, onSaved }) {
  const [serverError, setServerError] = useState(null);
  const [roles, setRoles] = useState([]);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(inviteUserFormSchema) });

  useEffect(() => {
    if (!open) return;
    reset({ firstName: '', lastName: '', email: '', role: '' });
    setServerError(null);
    rolesApi.list().then((res) => setRoles(res.data)).catch(() => {});
  }, [open, reset]);

  const onSubmit = async (values) => {
    setServerError(null);
    try {
      await usersApi.invite(values);
      onSaved();
      onClose();
    } catch (err) {
      setServerError(err.details?.map((d) => d.message).join(' ') || err.message);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Invite user" description="They'll receive an email with a link to set their password and activate their account.">
      {serverError && <Alert variant="error" className="mb-4">{serverError}</Alert>}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="First name" required error={errors.firstName?.message} {...register('firstName')} />
          <Field label="Last name" required error={errors.lastName?.message} {...register('lastName')} />
        </div>
        <Field label="Email address" type="email" required error={errors.email?.message} {...register('email')} />
        <SelectField label="Role" required error={errors.role?.message} {...register('role')}>
          <option value="">Select a role…</option>
          {roles.map((r) => <option key={r.id} value={r.name}>{r.name.replace('_', ' ')}</option>)}
        </SelectField>
        <div className="mt-2 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>Send invitation</Button>
        </div>
      </form>
    </Modal>
  );
}
