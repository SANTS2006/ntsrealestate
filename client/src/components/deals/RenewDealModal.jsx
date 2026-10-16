import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from '../ui/Modal.jsx';
import { Field } from '../ui/Input.jsx';
import { Button } from '../ui/Button.jsx';
import { Alert } from '../ui/Alert.jsx';
import { dealsApi } from '../../api/deals.js';

const schema = z.object({
  termMonths: z.coerce.number({ invalid_type_error: 'Enter the extra months.' }).int().min(1).max(600),
  installmentAmount: z.coerce.number({ invalid_type_error: 'Enter the amount.' }).positive('Enter the amount.'),
});

// Adds more time to an active rental or lease: more payments carry on from the
// last one and the end date moves out. The customer is told.
export function RenewDealModal({ deal, onClose, onSaved }) {
  const [serverError, setServerError] = useState(null);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!deal) return;
    setServerError(null);
    reset({ termMonths: deal.termMonths ?? 12, installmentAmount: deal.plan?.installmentAmount ?? deal.price });
  }, [deal, reset]);

  const onSubmit = async (values) => {
    setServerError(null);
    try {
      await dealsApi.renew(deal.id, values);
      onSaved();
      onClose();
    } catch (err) {
      setServerError(err.details?.map((d) => d.message).join(' ') || err.message);
    }
  };

  return (
    <Modal open={Boolean(deal)} onClose={onClose} title="Renew" description={deal ? `${deal.subject.title}${deal.tenant ? ` — ${deal.tenant.name}` : ''}` : undefined} size="md">
      {deal?.plan?.renewalRequestedAt && <Alert variant="info" className="mb-4">The customer has asked to renew.</Alert>}
      {serverError && <Alert variant="error" className="mb-4">{serverError}</Alert>}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <Field label="Extra time (months)" type="number" min="1" step="1" required error={errors.termMonths?.message} {...register('termMonths')} />
        <Field label={`Amount each ${deal?.plan?.frequency === 'yearly' ? 'year' : 'month'}`} type="number" min="0" step="0.01" required hint="Change it here if the price is changing with the renewal." error={errors.installmentAmount?.message} {...register('installmentAmount')} />
        <div className="mt-1 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>Renew</Button>
        </div>
      </form>
    </Modal>
  );
}
