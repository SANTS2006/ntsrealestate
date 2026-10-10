import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Modal } from '../ui/Modal.jsx';
import { Field, TextareaField } from '../ui/Input.jsx';
import { Button } from '../ui/Button.jsx';
import { Alert } from '../ui/Alert.jsx';
import { rolesApi } from '../../api/roles.js';

// `role` present = edit mode (name is immutable once created, only the
// description can change); absent = create mode.
export function RoleFormModal({ open, onClose, onSaved, role }) {
  const isEdit = Boolean(role);
  const [serverError, setServerError] = useState(null);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm();

  useEffect(() => {
    if (!open) return;
    reset({ name: role?.name ?? '', description: role?.description ?? '' });
    setServerError(null);
  }, [open, role, reset]);

  const onSubmit = async (values) => {
    setServerError(null);
    try {
      if (isEdit) {
        await rolesApi.update(role.id, { description: values.description });
      } else {
        await rolesApi.create(values);
      }
      onSaved();
      onClose();
    } catch (err) {
      setServerError(err.details?.map((d) => d.message).join(' ') || err.message);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit role' : 'New role'}
      description={isEdit ? 'The role name can\'t be changed once created.' : 'Roles start with no permissions — add them from the role\'s details page after creating it.'}
    >
      {serverError && <Alert variant="error" className="mb-4">{serverError}</Alert>}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        {isEdit ? (
          <Field label="Role name" value={role.name.replace(/_/g, ' ')} disabled className="capitalize" />
        ) : (
          <Field
            label="Role name"
            required
            hint="Lowercase letters, numbers, and underscores only, e.g. leasing_agent."
            error={errors.name?.message}
            {...register('name', {
              required: 'Role name is required.',
              pattern: { value: /^[a-z][a-z0-9_]*$/, message: 'Use lowercase letters, numbers, and underscores, starting with a letter.' },
            })}
          />
        )}
        <TextareaField label="Description" error={errors.description?.message} {...register('description')} />
        <div className="mt-2 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>{isEdit ? 'Save changes' : 'Create role'}</Button>
        </div>
      </form>
    </Modal>
  );
}
