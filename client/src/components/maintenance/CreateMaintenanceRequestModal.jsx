import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '../ui/Modal.jsx';
import { Field, SelectField, TextareaField } from '../ui/Input.jsx';
import { Button } from '../ui/Button.jsx';
import { Alert } from '../ui/Alert.jsx';
import { PendingMediaPicker } from '../media/PendingMediaPicker.jsx';
import { maintenanceApi } from '../../api/maintenance.js';
import { propertiesApi } from '../../api/properties.js';
import { buildingsApi } from '../../api/buildings.js';
import { unitsApi } from '../../api/units.js';
import { tenantsApi } from '../../api/tenants.js';
import { rentalsApi } from '../../api/rentals.js';
import { documentsApi } from '../../api/documents.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { maintenanceStaffFormSchema, maintenanceTenantFormSchema, PRIORITIES } from '../../validations/maintenance.js';

export function CreateMaintenanceRequestModal({ open, onClose, onSaved }) {
  const { user, hasRole } = useAuth();
  const isTenant = hasRole('tenant') && !hasRole('administrator', 'agent', 'maintenance_manager');
  const [serverError, setServerError] = useState(null);
  const [pendingFiles, setPendingFiles] = useState([]);

  // Staff-only state
  const [properties, setProperties] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [units, setUnits] = useState([]);
  const [tenants, setTenants] = useState([]);
  // Tenant-only state
  const [myUnits, setMyUnits] = useState([]);

  const schema = isTenant ? maintenanceTenantFormSchema : maintenanceStaffFormSchema;
  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) });
  const propertyId = watch('propertyId');
  const buildingId = watch('buildingId');

  useEffect(() => {
    if (!open) return;
    setServerError(null);
    setPendingFiles([]);
    if (isTenant) {
      reset({ unitId: '', title: '', description: '', priority: '' });
      // Only the places registered to this tenant — never every unit in the system.
      rentalsApi.scopeOptions().then((res) => {
        setMyUnits(res.data.units.map((u) => ({ id: u.id, unitNumber: u.unitNumber })));
      }).catch(() => {});
    } else {
      reset({ propertyId: '', buildingId: '', unitId: '', tenantId: '', title: '', description: '', priority: '' });
      setBuildings([]);
      setUnits([]);
      propertiesApi.list({ pageSize: 100, status: 'active' }).then((res) => setProperties(res.data)).catch(() => {});
      tenantsApi.list({ pageSize: 100, status: 'active' }).then((res) => setTenants(res.data)).catch(() => {});
    }
  }, [open, isTenant, reset]);

  useEffect(() => {
    if (isTenant || !open) return;
    setValue('buildingId', '');
    setValue('unitId', '');
    setUnits([]);
    if (!propertyId) { setBuildings([]); return; }
    buildingsApi.list(propertyId).then((res) => setBuildings(res.data)).catch(() => {});
  }, [propertyId, isTenant, open, setValue]);

  useEffect(() => {
    if (isTenant || !open) return;
    setValue('unitId', '');
    if (!buildingId) { setUnits([]); return; }
    unitsApi.list(buildingId).then((res) => setUnits(res.data)).catch(() => {});
  }, [buildingId, isTenant, open, setValue]);

  const onSubmit = async (values) => {
    setServerError(null);
    try {
      const { buildingId: _bid, ...body } = values;
      const created = await maintenanceApi.create(body);
      for (const file of pendingFiles) {
        await documentsApi.upload('maintenance_request', created.data.id, file);
      }
      onSaved();
      onClose();
    } catch (err) {
      setServerError(err.details?.map((d) => d.message).join(' ') || err.message);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New maintenance request" size="lg">
      {serverError && <Alert variant="error" className="mb-4">{serverError}</Alert>}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        {isTenant ? (
          <SelectField label="Unit" required error={errors.unitId?.message} {...register('unitId')}>
            <option value="">Select a unit…</option>
            {myUnits.map((u) => <option key={u.id} value={u.id}>Unit {u.unitNumber}</option>)}
          </SelectField>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <SelectField label="Property" required error={errors.propertyId?.message} {...register('propertyId')}>
                <option value="">Select a property…</option>
                {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </SelectField>
              <SelectField label="Building (optional)" disabled={!propertyId} {...register('buildingId')}>
                <option value="">Select a building…</option>
                {buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </SelectField>
              <SelectField label="Unit (optional)" disabled={!buildingId} error={errors.unitId?.message} {...register('unitId')}>
                <option value="">Select a unit…</option>
                {units.map((u) => <option key={u.id} value={u.id}>Unit {u.unitNumber}</option>)}
              </SelectField>
            </div>
            <SelectField label="Tenant (optional)" error={errors.tenantId?.message} {...register('tenantId')}>
              <option value="">No specific tenant</option>
              {tenants.map((t) => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}
            </SelectField>
          </>
        )}
        <Field label="Title" required error={errors.title?.message} {...register('title')} />
        <TextareaField label="Description" error={errors.description?.message} {...register('description')} />
        <SelectField label="Priority" error={errors.priority?.message} {...register('priority')}>
          <option value="">Medium (default)</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
        </SelectField>

        <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
          <PendingMediaPicker files={pendingFiles} onChange={setPendingFiles} label="Photos or videos of the issue (optional)" />
        </div>

        <div className="mt-2 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>Submit request</Button>
        </div>
      </form>
    </Modal>
  );
}
