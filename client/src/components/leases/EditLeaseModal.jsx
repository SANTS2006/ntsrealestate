import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '../ui/Modal.jsx';
import { Field } from '../ui/Input.jsx';
import { Button } from '../ui/Button.jsx';
import { Alert } from '../ui/Alert.jsx';
import { leasesApi } from '../../api/leases.js';
import { leaseEditFormSchema } from '../../validations/lease.js';

function toDateInput(value) {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 10);
}

export function EditLeaseModal({ open, onClose, onSaved, lease }) {
  const [serverError, setServerError] = useState(null);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(leaseEditFormSchema) });

  useEffect(() => {
    if (!open || !lease) return;
    reset({
      monthlyRent: lease.monthlyRent,
      securityDeposit: lease.securityDeposit ?? '',
      paymentDueDay: lease.paymentDueDay ?? '',
      endDate: toDateInput(lease.endDate),
    });
    setServerError(null);
  }, [open, lease, reset]);

  const onSubmit = async (values) => {
    setServerError(null);
    try {
      await leasesApi.update(lease.id, values);
      onSaved();
      onClose();
    } catch (err) {
      setServerError(err.details?.map((d) => d.message).join(' ') || err.message);
    }
  };

  if (!lease) return null;

  return (
    <Modal open={open} onClose={onClose} title="Edit lease" description={`Unit ${lease.unit?.unitNumber} · ${lease.tenant?.firstName} ${lease.tenant?.lastName}`}>
      {serverError && <Alert variant="error" className="mb-4">{serverError}</Alert>}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Monthly rent" type="number" step="0.01" error={errors.monthlyRent?.message} {...register('monthlyRent')} />
          <Field label="Security deposit" type="number" step="0.01" error={errors.securityDeposit?.message} {...register('securityDeposit')} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Rent due day" type="number" step="1" hint="Day of month (1–28)" error={errors.paymentDueDay?.message} {...register('paymentDueDay')} />
          <Field label="End date" type="date" error={errors.endDate?.message} {...register('endDate')} />
        </div>
        <div className="mt-2 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>Save changes</Button>
        </div>
      </form>
    </Modal>
  );
}
