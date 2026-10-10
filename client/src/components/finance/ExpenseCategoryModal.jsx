import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '../ui/Modal.jsx';
import { Field, TextareaField } from '../ui/Input.jsx';
import { Button } from '../ui/Button.jsx';
import { Alert } from '../ui/Alert.jsx';
import { expensesApi } from '../../api/expenses.js';
import { expenseCategoryFormSchema } from '../../validations/expense.js';

export function ExpenseCategoryModal({ open, onClose, onSaved }) {
  const [serverError, setServerError] = useState(null);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(expenseCategoryFormSchema) });

  useEffect(() => {
    if (!open) return;
    reset({ name: '', description: '' });
    setServerError(null);
  }, [open, reset]);

  const onSubmit = async (values) => {
    setServerError(null);
    try {
      const res = await expensesApi.createCategory(values);
      onSaved(res.data);
      onClose();
    } catch (err) {
      setServerError(err.details?.map((d) => d.message).join(' ') || err.message);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New expense category" size="sm">
      {serverError && <Alert variant="error" className="mb-4">{serverError}</Alert>}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <Field label="Name" required error={errors.name?.message} {...register('name')} />
        <TextareaField label="Description" error={errors.description?.message} {...register('description')} />
        <div className="mt-2 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>Create category</Button>
        </div>
      </form>
    </Modal>
  );
}
