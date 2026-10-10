import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '../ui/Modal.jsx';
import { Field, SelectField } from '../ui/Input.jsx';
import { Button } from '../ui/Button.jsx';
import { Alert } from '../ui/Alert.jsx';
import { invoicesApi } from '../../api/invoices.js';
import { tenantsApi } from '../../api/tenants.js';
import { leasesApi } from '../../api/leases.js';
import { invoiceCreateFormSchema } from '../../validations/invoice.js';

export function CreateInvoiceModal({ open, onClose, onSaved }) {
  const [serverError, setServerError] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [leases, setLeases] = useState([]);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(invoiceCreateFormSchema) });
  const tenantId = watch('tenantId');

  useEffect(() => {
    if (!open) return;
    reset({ tenantId: '', leaseId: '', issueDate: '', dueDate: '', subtotal: '', tax: '' });
    setServerError(null);
    setLeases([]);
    tenantsApi.list({ pageSize: 100, status: 'active' }).then((res) => setTenants(res.data)).catch(() => {});
  }, [open, reset]);

  useEffect(() => {
    setValue('leaseId', '');
    if (!tenantId) { setLeases([]); return; }
    leasesApi.list({ tenantId, pageSize: 20 }).then((res) => setLeases(res.data)).catch(() => {});
  }, [tenantId, setValue]);

  const onSubmit = async (values) => {
    setServerError(null);
    try {
      await invoicesApi.create(values);
      onSaved();
      onClose();
    } catch (err) {
      setServerError(err.details?.map((d) => d.message).join(' ') || err.message);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New invoice" description="New invoices start as a draft — send it once ready." size="lg">
      {serverError && <Alert variant="error" className="mb-4">{serverError}</Alert>}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField label="Tenant" required error={errors.tenantId?.message} {...register('tenantId')}>
            <option value="">Select a tenant…</option>
            {tenants.map((t) => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}
          </SelectField>
          <SelectField label="Lease (optional)" disabled={!tenantId} error={errors.leaseId?.message} {...register('leaseId')}>
            <option value="">No lease</option>
            {leases.map((l) => <option key={l.id} value={l.id}>Unit {l.unit?.unitNumber} — {l.status}</option>)}
          </SelectField>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Issue date" type="date" required error={errors.issueDate?.message} {...register('issueDate')} />
          <Field label="Due date" type="date" required error={errors.dueDate?.message} {...register('dueDate')} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Subtotal" type="number" step="0.01" required error={errors.subtotal?.message} {...register('subtotal')} />
          <Field label="Tax" type="number" step="0.01" error={errors.tax?.message} {...register('tax')} />
        </div>
        <div className="mt-2 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>Create invoice</Button>
        </div>
      </form>
    </Modal>
  );
}
