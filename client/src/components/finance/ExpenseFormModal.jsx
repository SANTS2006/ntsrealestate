import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus } from 'lucide-react';
import { Modal } from '../ui/Modal.jsx';
import { Field, SelectField, TextareaField } from '../ui/Input.jsx';
import { Button } from '../ui/Button.jsx';
import { Alert } from '../ui/Alert.jsx';
import { ExpenseCategoryModal } from './ExpenseCategoryModal.jsx';
import { expensesApi } from '../../api/expenses.js';
import { propertiesApi } from '../../api/properties.js';
import { expenseFormSchema } from '../../validations/expense.js';

export function ExpenseFormModal({ open, onClose, onSaved }) {
  const [serverError, setServerError] = useState(null);
  const [categories, setCategories] = useState([]);
  const [properties, setProperties] = useState([]);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);

  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(expenseFormSchema) });

  const loadCategories = () => expensesApi.listCategories().then((res) => setCategories(res.data)).catch(() => {});

  useEffect(() => {
    if (!open) return;
    reset({ categoryId: '', propertyId: '', amount: '', expenseDate: '', description: '' });
    setServerError(null);
    loadCategories();
    propertiesApi.list({ pageSize: 100, status: 'active' }).then((res) => setProperties(res.data)).catch(() => {});
  }, [open, reset]);

  const onSubmit = async (values) => {
    setServerError(null);
    try {
      await expensesApi.create(values);
      onSaved();
      onClose();
    } catch (err) {
      setServerError(err.details?.map((d) => d.message).join(' ') || err.message);
    }
  };

  return (
    <>
      <Modal open={open} onClose={onClose} title="New expense" description="Submitted expenses require approval before they're marked paid.">
        {serverError && <Alert variant="error" className="mb-4">{serverError}</Alert>}
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <div className="flex items-end gap-2">
            <SelectField label="Category" required className="flex-1" error={errors.categoryId?.message} {...register('categoryId')}>
              <option value="">Select a category…</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </SelectField>
            <Button type="button" variant="secondary" onClick={() => setCategoryModalOpen(true)} aria-label="Add category">
              <Plus size={16} aria-hidden="true" />
            </Button>
          </div>
          <SelectField label="Property (optional)" error={errors.propertyId?.message} {...register('propertyId')}>
            <option value="">No specific property</option>
            {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </SelectField>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Amount" type="number" step="0.01" required error={errors.amount?.message} {...register('amount')} />
            <Field label="Expense date" type="date" required error={errors.expenseDate?.message} {...register('expenseDate')} />
          </div>
          <TextareaField label="Description" error={errors.description?.message} {...register('description')} />
          <div className="mt-2 flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={isSubmitting}>Submit expense</Button>
          </div>
        </form>
      </Modal>
      <ExpenseCategoryModal
        open={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
        onSaved={(category) => { loadCategories(); setValue('categoryId', category.id); }}
      />
    </>
  );
}
