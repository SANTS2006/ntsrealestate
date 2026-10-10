import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Modal } from '../ui/Modal.jsx';
import { Field, TextareaField } from '../ui/Input.jsx';
import { Button } from '../ui/Button.jsx';
import { Alert } from '../ui/Alert.jsx';
import { permissionsApi } from '../../api/permissions.js';

// `permission` present = edit mode (name is immutable, only the description
// can change — the name is what `requirePermission()` checks match
// against); absent = create mode.
export function PermissionFormModal({ open, onClose, onSaved, permission }) {
  const isEdit = Boolean(permission);
  const [serverError, setServerError] = useState(null);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm();

  useEffect(() => {
    if (!open) return;
    reset({ name: permission?.name ?? '', description: permission?.description ?? '' });
    setServerError(null);
  }, [open, permission, reset]);

  const onSubmit = async (values) => {
    setServerError(null);
    try {
      if (isEdit) {
        await permissionsApi.update(permission.id, { description: values.description });
      } else {
        await permissionsApi.create(values);
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
      title={isEdit ? 'Edit permission' : 'New permission'}
      description={isEdit ? 'The permission name can\'t be changed once created.' : 'Once created, it can be assigned to any role from the Roles tab.'}
    >
      {serverError && <Alert variant="error" className="mb-4">{serverError}</Alert>}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        {isEdit ? (
          <Field label="Permission name" value={permission.name} disabled className="font-mono" />
        ) : (
          <Field
            label="Permission name"
            required
            placeholder="e.g. reports:export"
            hint='Format: "resource:action" — lowercase letters, numbers, and hyphens.'
            error={errors.name?.message}
            {...register('name', {
              required: 'Permission name is required.',
              pattern: { value: /^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$/, message: 'Use the format "resource:action" (lowercase, hyphens allowed).' },
            })}
          />
        )}
        <TextareaField label="Description" error={errors.description?.message} {...register('description')} />
        <div className="mt-2 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>{isEdit ? 'Save changes' : 'Create permission'}</Button>
        </div>
      </form>
    </Modal>
  );
}
