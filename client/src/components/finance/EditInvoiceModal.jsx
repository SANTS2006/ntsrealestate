import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '../ui/Modal.jsx';
import { Field } from '../ui/Input.jsx';
import { Button } from '../ui/Button.jsx';
import { Alert } from '../ui/Alert.jsx';
import { invoicesApi } from '../../api/invoices.js';
import { invoiceEditFormSchema } from '../../validations/invoice.js';

function toDateInput(value) {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 10);
}

export function EditInvoiceModal({ open, onClose, onSaved, invoice }) {
  const [serverError, setServerError] = useState(null);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(invoiceEditFormSchema) });

  useEffect(() => {
    if (!open || !invoice) return;
    reset({ dueDate: toDateInput(invoice.dueDate), subtotal: invoice.subtotal, tax: invoice.tax ?? '' });
    setServerError(null);
  }, [open, invoice, reset]);

  const onSubmit = async (values) => {
    setServerError(null);
    try {
      await invoicesApi.update(invoice.id, values);
      onSaved();
      onClose();
    } catch (err) {
      setServerError(err.details?.map((d) => d.message).join(' ') || err.message);
    }
  };

  if (!invoice) return null;

  return (
    <Modal open={open} onClose={onClose} title="Edit invoice" description={invoice.invoiceNumber}>
      {serverError && <Alert variant="error" className="mb-4">{serverError}</Alert>}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <Field label="Due date" type="date" error={errors.dueDate?.message} {...register('dueDate')} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Subtotal" type="number" step="0.01" error={errors.subtotal?.message} {...register('subtotal')} />
          <Field label="Tax" type="number" step="0.01" error={errors.tax?.message} {...register('tax')} />
        </div>
        <div className="mt-2 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>Save changes</Button>
        </div>
      </form>
    </Modal>
  );
}
