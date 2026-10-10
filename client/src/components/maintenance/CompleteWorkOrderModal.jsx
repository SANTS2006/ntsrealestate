import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '../ui/Modal.jsx';
import { Field } from '../ui/Input.jsx';
import { Button } from '../ui/Button.jsx';
import { Alert } from '../ui/Alert.jsx';
import { MediaGallery } from '../media/MediaGallery.jsx';
import { workOrdersApi } from '../../api/workOrders.js';
import { workOrderCompleteFormSchema } from '../../validations/maintenance.js';

export function CompleteWorkOrderModal({ open, onClose, onSaved, workOrder }) {
  const [serverError, setServerError] = useState(null);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(workOrderCompleteFormSchema) });

  useEffect(() => {
    if (!open) return;
    reset({ actualCost: '' });
    setServerError(null);
  }, [open, reset]);

  const onSubmit = async (values) => {
    setServerError(null);
    try {
      await workOrdersApi.complete(workOrder.id, values.actualCost);
      onSaved();
      onClose();
    } catch (err) {
      setServerError(err.details?.map((d) => d.message).join(' ') || err.message);
    }
  };

  if (!workOrder) return null;

  return (
    <Modal open={open} onClose={onClose} title="Complete work order" description="If an actual cost is entered, a matching expense is drafted automatically for approval." size="lg">
      {serverError && <Alert variant="error" className="mb-4">{serverError}</Alert>}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <Field label="Actual cost (optional)" type="number" step="0.01" error={errors.actualCost?.message} {...register('actualCost')} />

        <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
          <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Completion photos</p>
          <MediaGallery entityType="work_order" entityId={workOrder.id} canUpload canDelete />
        </div>

        <div className="mt-2 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>Complete work order</Button>
        </div>
      </form>
    </Modal>
  );
}
