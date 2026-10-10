import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '../ui/Modal.jsx';
import { Field, SelectField, TextareaField } from '../ui/Input.jsx';
import { Button } from '../ui/Button.jsx';
import { Alert } from '../ui/Alert.jsx';
import { paymentsApi } from '../../api/payments.js';
import { tenantsApi } from '../../api/tenants.js';
import { invoicesApi } from '../../api/invoices.js';
import { paymentFormSchema, PAYMENT_METHODS } from '../../validations/payment.js';
import { formatCurrency } from '../../utils/currency.js';

// `presetInvoice` locks the tenant/invoice and defaults the amount to the
// outstanding balance — used by the "Record payment" action on a specific
// invoice row. Without it, this is the general standalone flow from the
// Payments page: pick any tenant, then optionally one of their invoices.
export function RecordPaymentModal({ open, onClose, onSaved, presetInvoice }) {
  const [serverError, setServerError] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [invoices, setInvoices] = useState([]);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(paymentFormSchema) });
  const tenantId = watch('tenantId');

  useEffect(() => {
    if (!open) return;
    setServerError(null);
    if (presetInvoice) {
      reset({
        tenantId: presetInvoice.tenantId,
        invoiceId: presetInvoice.id,
        amount: presetInvoice.balance,
        paymentDate: '',
        paymentMethod: '',
        reference: '',
        notes: '',
      });
      setInvoices([]);
    } else {
      reset({ tenantId: '', invoiceId: '', amount: '', paymentDate: '', paymentMethod: '', reference: '', notes: '' });
      setInvoices([]);
      tenantsApi.list({ pageSize: 100, status: 'active' }).then((res) => setTenants(res.data)).catch(() => {});
    }
  }, [open, presetInvoice, reset]);

  useEffect(() => {
    if (presetInvoice || !open) return;
    setValue('invoiceId', '');
    if (!tenantId) { setInvoices([]); return; }
    invoicesApi.list({ tenantId, pageSize: 50 }).then((res) => setInvoices(res.data.filter((i) => Number(i.balance) > 0))).catch(() => {});
  }, [tenantId, presetInvoice, open, setValue]);

  const onSubmit = async (values) => {
    setServerError(null);
    try {
      const body = { ...values, idempotencyKey: crypto.randomUUID() };
      await paymentsApi.create(body);
      onSaved();
      onClose();
    } catch (err) {
      setServerError(err.details?.map((d) => d.message).join(' ') || err.message);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Record payment" size="lg">
      {serverError && <Alert variant="error" className="mb-4">{serverError}</Alert>}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        {presetInvoice ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Invoice <span className="font-medium text-slate-900 dark:text-slate-100">{presetInvoice.invoiceNumber}</span> — outstanding balance {formatCurrency(presetInvoice.balance)}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SelectField label="Tenant" required error={errors.tenantId?.message} {...register('tenantId')}>
              <option value="">Select a tenant…</option>
              {tenants.map((t) => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}
            </SelectField>
            <SelectField label="Invoice (optional)" disabled={!tenantId} error={errors.invoiceId?.message} {...register('invoiceId')}>
              <option value="">No invoice</option>
              {invoices.map((i) => <option key={i.id} value={i.id}>{i.invoiceNumber} — {formatCurrency(i.balance)} due</option>)}
            </SelectField>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Amount" type="number" step="0.01" required error={errors.amount?.message} {...register('amount')} />
          <Field label="Payment date" type="date" hint="Defaults to today" error={errors.paymentDate?.message} {...register('paymentDate')} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField label="Payment method" required error={errors.paymentMethod?.message} {...register('paymentMethod')}>
            <option value="">Select a method…</option>
            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
          </SelectField>
          <Field label="Reference" placeholder="Check #, transaction ID…" error={errors.reference?.message} {...register('reference')} />
        </div>
        <TextareaField label="Notes" error={errors.notes?.message} {...register('notes')} />

        <div className="mt-2 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>Record payment</Button>
        </div>
      </form>
    </Modal>
  );
}
