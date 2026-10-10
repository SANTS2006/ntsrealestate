import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from '../ui/Modal.jsx';
import { Field, SelectField } from '../ui/Input.jsx';
import { Button } from '../ui/Button.jsx';
import { Alert } from '../ui/Alert.jsx';
import { paymentsApi } from '../../api/payments.js';
import { formatCurrency } from '../../utils/currency.js';

const schema = z.object({
  amount: z.coerce.number({ invalid_type_error: 'Enter the amount.' }).positive('Enter the amount.'),
  paymentMethod: z.enum(['cash', 'bank_transfer', 'card', 'mobile_money', 'cheque', 'other']),
  reference: z.preprocess((v) => (v === '' ? undefined : v), z.string().trim().max(200).optional()),
});

// Records money received for a deal (rent, a purchase instalment, a lease
// payment). It shows up in the customer's "My payments" and in the Payments
// module of everyone who manages that house or land.
export function DealPaymentModal({ deal, onClose, onSaved }) {
  const [serverError, setServerError] = useState(null);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!deal) return;
    reset({ amount: deal.kind === 'rent' ? deal.price : deal.balance || '', paymentMethod: 'cash', reference: '' });
    setServerError(null);
  }, [deal, reset]);

  const onSubmit = async (values) => {
    setServerError(null);
    try {
      await paymentsApi.create({ ...values, dealId: deal.id, idempotencyKey: crypto.randomUUID() });
      onSaved();
      onClose();
    } catch (err) {
      setServerError(err.details?.map((d) => d.message).join(' ') || err.message);
    }
  };

  return (
    <Modal open={Boolean(deal)} onClose={onClose} title="Record payment" description={deal ? `${deal.subject.title}${deal.tenant ? ` — ${deal.tenant.name}` : ''}` : undefined} size="md">
      {deal && (
        <div className="mb-4 grid grid-cols-3 gap-3 rounded-lg bg-slate-50 p-3 text-center text-xs dark:bg-slate-800/50">
          <div><p className="text-slate-400">Price</p><p className="mt-0.5 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(deal.price)}</p></div>
          <div><p className="text-slate-400">Paid</p><p className="mt-0.5 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(deal.paid)}</p></div>
          <div><p className="text-slate-400">Balance</p><p className="mt-0.5 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{deal.kind === 'rent' ? '—' : formatCurrency(deal.balance)}</p></div>
        </div>
      )}
      {serverError && <Alert variant="error" className="mb-4">{serverError}</Alert>}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <Field label="Amount received" required type="number" step="0.01" min="0" error={errors.amount?.message} {...register('amount')} />
        <SelectField label="Paid by" required error={errors.paymentMethod?.message} {...register('paymentMethod')}>
          <option value="cash">Cash</option>
          <option value="bank_transfer">Bank transfer</option>
          <option value="mobile_money">Mobile money</option>
          <option value="card">Card</option>
          <option value="cheque">Cheque</option>
          <option value="other">Other</option>
        </SelectField>
        <Field label="Reference" hint="Receipt or transfer number (optional)." error={errors.reference?.message} {...register('reference')} />
        <div className="mt-1 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>Record payment</Button>
        </div>
      </form>
    </Modal>
  );
}
