import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from '../ui/Modal.jsx';
import { Field, SelectField } from '../ui/Input.jsx';
import { Button } from '../ui/Button.jsx';
import { Alert } from '../ui/Alert.jsx';
import { dealsApi } from '../../api/deals.js';
import { FREQUENCY } from '../../config/dealLabels.js';
import { formatCurrency } from '../../utils/currency.js';

const schema = z.object({
  startDate: z.string().min(1, 'Choose when it starts.'),
  termMonths: z.coerce.number({ invalid_type_error: 'Enter the length in months.' }).int('Whole months only.').min(1, 'At least 1 month.').max(600),
  frequency: z.enum(['monthly', 'yearly']),
  installmentAmount: z.coerce.number({ invalid_type_error: 'Enter the amount.' }).positive('Enter the amount.'),
  securityDeposit: z.preprocess((v) => (v === '' || v === undefined ? undefined : v), z.coerce.number().min(0).optional()),
});

const today = () => new Date().toISOString().slice(0, 10);

// The agent decides how the customer pays: for how long, monthly or yearly, and
// how much each time. The list of payments is created from it and every payment
// recorded later is ticked off against it.
export function DealPlanModal({ deal, onClose, onSaved }) {
  const [serverError, setServerError] = useState(null);
  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!deal) return;
    setServerError(null);
    reset({
      startDate: deal.plan?.startDate ? String(deal.plan.startDate).slice(0, 10) : today(),
      termMonths: deal.termMonths ?? 12,
      frequency: deal.plan?.frequency ?? (deal.kind === 'lease' ? 'yearly' : 'monthly'),
      installmentAmount: deal.plan?.installmentAmount ?? deal.price,
      securityDeposit: deal.plan?.securityDeposit ?? '',
    });
  }, [deal, reset]);

  const v = watch();
  const count = v.frequency === 'yearly' ? Math.ceil((Number(v.termMonths) || 0) / 12) : Number(v.termMonths) || 0;
  const total = count * (Number(v.installmentAmount) || 0);

  const onSubmit = async (values) => {
    setServerError(null);
    try {
      await dealsApi.setPlan(deal.id, {
        startDate: new Date(`${values.startDate}T00:00:00Z`).toISOString(),
        termMonths: values.termMonths, frequency: values.frequency, installmentAmount: values.installmentAmount,
        ...(values.securityDeposit !== undefined ? { securityDeposit: values.securityDeposit } : {}),
      });
      onSaved();
      onClose();
    } catch (err) {
      setServerError(err.details?.map((d) => d.message).join(' ') || err.message);
    }
  };

  return (
    <Modal open={Boolean(deal)} onClose={onClose} title="Payment plan" description={deal ? `${deal.subject.title}${deal.tenant ? ` — ${deal.tenant.name}` : ''}` : undefined} size="md">
      {serverError && <Alert variant="error" className="mb-4">{serverError}</Alert>}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Starts on" type="date" required error={errors.startDate?.message} {...register('startDate')} />
          <Field label="Length (months)" type="number" min="1" step="1" required error={errors.termMonths?.message} {...register('termMonths')} />
          <SelectField label="Pays" required error={errors.frequency?.message} {...register('frequency')}>
            {Object.entries(FREQUENCY).map(([value, f]) => <option key={value} value={value}>{f.label}</option>)}
          </SelectField>
          <Field label={`Amount each ${FREQUENCY[v.frequency]?.unit ?? 'time'}`} type="number" min="0" step="0.01" required error={errors.installmentAmount?.message} {...register('installmentAmount')} />
        </div>
        <Field label="Security deposit" type="number" min="0" step="0.01" hint="Optional." error={errors.securityDeposit?.message} {...register('securityDeposit')} />
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:bg-slate-800/50 dark:text-slate-300">
          {count > 0 ? `${count} payment${count === 1 ? '' : 's'} of ${formatCurrency(Number(v.installmentAmount) || 0)}, ${formatCurrency(total)} in all.` : 'Enter the length of the term.'}
        </p>
        <div className="mt-1 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>Save plan</Button>
        </div>
      </form>
    </Modal>
  );
}
