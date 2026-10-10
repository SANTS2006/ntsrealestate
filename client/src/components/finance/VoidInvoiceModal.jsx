import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '../ui/Modal.jsx';
import { TextareaField } from '../ui/Input.jsx';
import { Button } from '../ui/Button.jsx';
import { Alert } from '../ui/Alert.jsx';
import { invoicesApi } from '../../api/invoices.js';
import { invoiceVoidFormSchema } from '../../validations/invoice.js';

export function VoidInvoiceModal({ open, onClose, onSaved, invoice }) {
  const [serverError, setServerError] = useState(null);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(invoiceVoidFormSchema) });

  useEffect(() => {
    if (!open) return;
    reset({ reason: '' });
    setServerError(null);
  }, [open, reset]);

  const onSubmit = async (values) => {
    setServerError(null);
    try {
      await invoicesApi.void(invoice.id, values.reason || undefined);
      onSaved();
      onClose();
    } catch (err) {
      setServerError(err.message);
    }
  };

  if (!invoice) return null;

  return (
    <Modal open={open} onClose={onClose} title="Void invoice" description={`${invoice.invoiceNumber} — this cannot be undone.`}>
      {serverError && <Alert variant="error" className="mb-4">{serverError}</Alert>}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <TextareaField label="Reason (optional)" error={errors.reason?.message} {...register('reason')} />
        <div className="mt-2 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="danger" loading={isSubmitting}>Void invoice</Button>
        </div>
      </form>
    </Modal>
  );
}
