import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '../ui/Modal.jsx';
import { Field, SelectField } from '../ui/Input.jsx';
import { Button } from '../ui/Button.jsx';
import { Alert } from '../ui/Alert.jsx';
import { leasesApi } from '../../api/leases.js';
import { propertiesApi } from '../../api/properties.js';
import { buildingsApi } from '../../api/buildings.js';
import { unitsApi } from '../../api/units.js';
import { tenantsApi } from '../../api/tenants.js';
import { leaseCreateFormSchema } from '../../validations/lease.js';
import { formatCurrency } from '../../utils/currency.js';

export function CreateLeaseModal({ open, onClose, onSaved }) {
  const [serverError, setServerError] = useState(null);
  const [properties, setProperties] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [units, setUnits] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [propertyId, setPropertyId] = useState('');
  const [buildingId, setBuildingId] = useState('');

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(leaseCreateFormSchema) });
  const selectedUnitId = watch('unitId');
  const selectedUnit = units.find((u) => u.id === selectedUnitId);

  useEffect(() => {
    if (!open) return;
    reset({ unitId: '', tenantId: '', startDate: '', endDate: '', monthlyRent: '', securityDeposit: '', paymentDueDay: '' });
    setServerError(null);
    setPropertyId('');
    setBuildingId('');
    setBuildings([]);
    setUnits([]);
    propertiesApi.list({ pageSize: 100, status: 'active' }).then((res) => setProperties(res.data)).catch(() => {});
    tenantsApi.list({ pageSize: 100, status: 'active' }).then((res) => setTenants(res.data)).catch(() => {});
  }, [open, reset]);

  useEffect(() => {
    setBuildingId('');
    setUnits([]);
    setValue('unitId', '');
    if (!propertyId) { setBuildings([]); return; }
    buildingsApi.list(propertyId).then((res) => setBuildings(res.data)).catch(() => {});
  }, [propertyId, setValue]);

  useEffect(() => {
    setValue('unitId', '');
    if (!buildingId) { setUnits([]); return; }
    unitsApi.list(buildingId, { status: 'available' }).then((res) => setUnits(res.data)).catch(() => {});
  }, [buildingId, setValue]);

  useEffect(() => {
    if (selectedUnit) setValue('monthlyRent', selectedUnit.monthlyRent);
  }, [selectedUnit, setValue]);

  const onSubmit = async (values) => {
    setServerError(null);
    try {
      await leasesApi.create(values);
      onSaved();
      onClose();
    } catch (err) {
      setServerError(err.details?.map((d) => d.message).join(' ') || err.message);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New lease" description="New leases start as a draft — activate it once terms are confirmed." size="lg">
      {serverError && <Alert variant="error" className="mb-4">{serverError}</Alert>}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <SelectField label="Tenant" required error={errors.tenantId?.message} {...register('tenantId')}>
          <option value="">Select a tenant…</option>
          {tenants.map((t) => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}
        </SelectField>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SelectField label="Property" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
            <option value="">Select a property…</option>
            {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </SelectField>
          <SelectField label="Building" value={buildingId} onChange={(e) => setBuildingId(e.target.value)} disabled={!propertyId}>
            <option value="">Select a building…</option>
            {buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </SelectField>
          <SelectField label="Unit" required disabled={!buildingId} error={errors.unitId?.message} {...register('unitId')}>
            <option value="">Select a unit…</option>
            {units.map((u) => <option key={u.id} value={u.id}>Unit {u.unitNumber} — {formatCurrency(u.monthlyRent)}/mo</option>)}
          </SelectField>
        </div>
        {buildingId && units.length === 0 && (
          <p className="-mt-2 text-xs text-amber-600 dark:text-amber-400">No available units in this building.</p>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Start date" type="date" required error={errors.startDate?.message} {...register('startDate')} />
          <Field label="End date" type="date" required error={errors.endDate?.message} {...register('endDate')} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Monthly rent" type="number" step="0.01" required error={errors.monthlyRent?.message} {...register('monthlyRent')} />
          <Field label="Security deposit" type="number" step="0.01" error={errors.securityDeposit?.message} {...register('securityDeposit')} />
          <Field label="Rent due day" type="number" step="1" placeholder="1" hint="Day of month (1–28)" error={errors.paymentDueDay?.message} {...register('paymentDueDay')} />
        </div>

        <div className="mt-2 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>Create lease</Button>
        </div>
      </form>
    </Modal>
  );
}
