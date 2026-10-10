import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '../ui/Modal.jsx';
import { TextareaField } from '../ui/Input.jsx';
import { Button } from '../ui/Button.jsx';
import { Alert } from '../ui/Alert.jsx';
import { leasesApi } from '../../api/leases.js';
import { leaseTerminateFormSchema } from '../../validations/lease.js';

export function TerminateLeaseModal({ open, onClose, onSaved, lease }) {
  const [serverError, setServerError] = useState(null);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(leaseTerminateFormSchema) });

  useEffect(() => {
    if (!open) return;
    reset({ reason: '' });
    setServerError(null);
  }, [open, reset]);

  const onSubmit = async (values) => {
    setServerError(null);
    try {
      await leasesApi.terminate(lease.id, values.reason || undefined);
      onSaved();
      onClose();
    } catch (err) {
      setServerError(err.message);
    }
  };

  if (!lease) return null;

  return (
    <Modal open={open} onClose={onClose} title="Terminate lease" description={`This frees up unit ${lease.unit?.unitNumber} and cannot be undone.`}>
      {serverError && <Alert variant="error" className="mb-4">{serverError}</Alert>}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <TextareaField label="Reason (optional)" error={errors.reason?.message} {...register('reason')} />
        <div className="mt-2 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="danger" loading={isSubmitting}>Terminate lease</Button>
        </div>
      </form>
    </Modal>
  );
}
