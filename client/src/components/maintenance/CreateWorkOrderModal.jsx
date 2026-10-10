import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '../ui/Modal.jsx';
import { Field, SelectField } from '../ui/Input.jsx';
import { Button } from '../ui/Button.jsx';
import { Alert } from '../ui/Alert.jsx';
import { maintenanceApi } from '../../api/maintenance.js';
import { vendorsApi } from '../../api/vendors.js';
import { propertiesApi } from '../../api/properties.js';
import { workOrderCreateFormSchema } from '../../validations/maintenance.js';

export function CreateWorkOrderModal({ open, onClose, onSaved, request }) {
  const [serverError, setServerError] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [staff, setStaff] = useState([]);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(workOrderCreateFormSchema) });

  useEffect(() => {
    if (!open || !request) return;
    reset({ vendorId: '', assignedStaffId: '', scheduledDate: '', estimatedCost: '' });
    setServerError(null);
    vendorsApi.list({ pageSize: 100, status: 'active' }).then((res) => setVendors(res.data)).catch(() => {});
    propertiesApi.listAssignments(request.propertyId).then((res) => setStaff(res.data)).catch(() => {});
  }, [open, request, reset]);

  const onSubmit = async (values) => {
    setServerError(null);
    try {
      await maintenanceApi.createWorkOrder(request.id, values);
      onSaved();
      onClose();
    } catch (err) {
      setServerError(err.details?.map((d) => d.message).join(' ') || err.message);
    }
  };

  if (!request) return null;

  return (
    <Modal open={open} onClose={onClose} title="New work order" description={request.title}>
      {serverError && <Alert variant="error" className="mb-4">{serverError}</Alert>}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <SelectField label="Vendor (optional)" error={errors.vendorId?.message} {...register('vendorId')}>
          <option value="">No vendor</option>
          {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </SelectField>
        <SelectField label="Assigned staff (optional)" error={errors.assignedStaffId?.message} {...register('assignedStaffId')}>
          <option value="">No staff assigned</option>
          {staff.map((s) => <option key={s.userId} value={s.userId}>{s.firstName} {s.lastName}</option>)}
        </SelectField>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Scheduled date" type="date" hint="Sets the request to scheduled" error={errors.scheduledDate?.message} {...register('scheduledDate')} />
          <Field label="Estimated cost" type="number" step="0.01" error={errors.estimatedCost?.message} {...register('estimatedCost')} />
        </div>
        <div className="mt-2 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>Create work order</Button>
        </div>
      </form>
    </Modal>
  );
}
