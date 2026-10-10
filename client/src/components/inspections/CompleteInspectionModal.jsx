import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '../ui/Modal.jsx';
import { Field, TextareaField } from '../ui/Input.jsx';
import { Button } from '../ui/Button.jsx';
import { Alert } from '../ui/Alert.jsx';
import { MediaGallery } from '../media/MediaGallery.jsx';
import { inspectionsApi } from '../../api/inspections.js';
import { inspectionCompleteFormSchema } from '../../validations/inspection.js';

export function CompleteInspectionModal({ open, onClose, onSaved, inspection }) {
  const [serverError, setServerError] = useState(null);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(inspectionCompleteFormSchema) });

  useEffect(() => {
    if (!open || !inspection) return;
    reset({ condition: inspection.condition ?? '', notes: inspection.notes ?? '' });
    setServerError(null);
  }, [open, inspection, reset]);

  const onSubmit = async (values) => {
    setServerError(null);
    try {
      await inspectionsApi.complete(inspection.id, values);
      onSaved();
      onClose();
    } catch (err) {
      setServerError(err.details?.map((d) => d.message).join(' ') || err.message);
    }
  };

  if (!inspection) return null;

  return (
    <Modal open={open} onClose={onClose} title="Complete inspection" size="lg">
      {serverError && <Alert variant="error" className="mb-4">{serverError}</Alert>}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <Field label="Condition" placeholder="e.g. Good, Fair, Needs repair" error={errors.condition?.message} {...register('condition')} />
        <TextareaField label="Notes" error={errors.notes?.message} {...register('notes')} />

        <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
          <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Photos</p>
          <MediaGallery entityType="inspection" entityId={inspection.id} canUpload canDelete />
        </div>

        <div className="mt-2 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>Complete inspection</Button>
        </div>
      </form>
    </Modal>
  );
}
