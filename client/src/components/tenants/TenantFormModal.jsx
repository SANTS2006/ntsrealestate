import { useEffect, useState } from 'react';
import { ConnectionsPanel } from '../connections/ConnectionsPanel.jsx';
import { hasPermission } from '../../config/capabilities.js';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '../ui/Modal.jsx';
import { Field, SelectField } from '../ui/Input.jsx';
import { Button } from '../ui/Button.jsx';
import { Alert } from '../ui/Alert.jsx';
import { MediaGallery } from '../media/MediaGallery.jsx';
import { PendingMediaPicker } from '../media/PendingMediaPicker.jsx';
import { tenantsApi } from '../../api/tenants.js';
import { documentsApi } from '../../api/documents.js';
import { propertiesApi } from '../../api/properties.js';
import { buildingsApi } from '../../api/buildings.js';
import { unitsApi } from '../../api/units.js';
import { tenantFormSchema } from '../../validations/tenant.js';

// Buildings/units aren't listed org-wide by any single endpoint — a tenant
// picks a property first (loaded once, up front) to narrow the building
// list, then a building to narrow the unit list, reusing the same nested
// endpoints the Properties pages already call. This keeps the picker fast
// even for a large portfolio instead of dumping every unit in one dropdown.
function ResidencePicker({ register, watch, setValue, initialBuildingId, initialUnitId }) {
  const [properties, setProperties] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [units, setUnits] = useState([]);
  const [propertyId, setPropertyId] = useState('');
  const buildingId = watch('buildingId');

  useEffect(() => {
    propertiesApi.list({ pageSize: 100 }).then((res) => setProperties(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!propertyId) { setBuildings([]); return; }
    buildingsApi.list(propertyId).then((res) => setBuildings(res.data)).catch(() => setBuildings([]));
  }, [propertyId]);

  useEffect(() => {
    if (!buildingId) { setUnits([]); return; }
    unitsApi.list(buildingId).then((res) => setUnits(res.data)).catch(() => setUnits([]));
  }, [buildingId]);

  // Applying the initial building/unit has to wait until their <option>
  // elements actually exist in the DOM — setValue writes straight to the
  // <select> element, and setting it to an id with no matching <option> yet
  // (e.g. right when the fetch above resolves, before React has re-rendered
  // with the new list) is silently a no-op. Keying off the `buildings`/
  // `units` state itself (rather than doing this inside the fetch's .then())
  // guarantees the render with those options has already committed.
  useEffect(() => {
    if (initialBuildingId && buildings.some((b) => b.id === initialBuildingId)) {
      setValue('buildingId', initialBuildingId);
    }
  }, [buildings, initialBuildingId, setValue]);

  useEffect(() => {
    if (initialUnitId && units.some((u) => u.id === initialUnitId)) {
      setValue('unitId', initialUnitId);
    }
  }, [units, initialUnitId, setValue]);

  // Best-effort: once properties (and later buildings) are loaded, find
  // which property owns the tenant's existing building so the cascading
  // selects start pre-filled on edit rather than blank.
  useEffect(() => {
    if (!initialBuildingId || properties.length === 0 || propertyId) return;
    (async () => {
      for (const p of properties) {
        try {
          const res = await buildingsApi.list(p.id);
          if (res.data.some((b) => b.id === initialBuildingId)) {
            setPropertyId(p.id);
            break;
          }
        } catch {
          // ignore and keep trying other properties
        }
      }
    })();
  }, [initialBuildingId, properties, propertyId]);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <SelectField
        label="Property"
        value={propertyId}
        onChange={(e) => {
          setPropertyId(e.target.value);
          setValue('buildingId', '');
          setValue('unitId', '');
        }}
      >
        <option value="">Not linked</option>
        {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </SelectField>
      <SelectField
        label="Building"
        disabled={!propertyId}
        {...register('buildingId')}
        value={buildingId ?? ''}
        onChange={(e) => {
          setValue('buildingId', e.target.value);
          setValue('unitId', '');
        }}
      >
        <option value="">{propertyId ? 'Select a building' : 'Select a property first'}</option>
        {buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
      </SelectField>
      <SelectField
        label="Unit"
        disabled={!buildingId}
        {...register('unitId')}
        value={watch('unitId') ?? ''}
        onChange={(e) => setValue('unitId', e.target.value)}
      >
        <option value="">{buildingId ? 'Select a unit' : 'Select a building first'}</option>
        {units.map((u) => <option key={u.id} value={u.id}>{u.unitNumber}</option>)}
      </SelectField>
    </div>
  );
}

const TENANT_STATUSES = ['active', 'inactive', 'former'];

function StatusControl({ tenant, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = async (e) => {
    setError(null);
    setBusy(true);
    try {
      const updated = await tenantsApi.setStatus(tenant.id, e.target.value);
      onChanged(updated.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5 dark:bg-slate-800/50">
      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Status</p>
      <div className="flex items-center gap-2">
        {error && <span className="text-xs text-rose-600 dark:text-rose-400">{error}</span>}
        <select
          value={tenant.status}
          onChange={handleChange}
          disabled={busy}
          className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          {TENANT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
    </div>
  );
}

export function TenantFormModal({ open, onClose, onSaved, tenant }) {
  const isEdit = Boolean(tenant);
  // Opening an existing tenant without permission to change it shows it read-only.
  const readOnly = isEdit && !hasPermission('tenants:update');
  const [serverError, setServerError] = useState(null);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [liveTenant, setLiveTenant] = useState(tenant);
  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(tenantFormSchema) });

  useEffect(() => {
    if (!open) return;
    reset(
      tenant
        ? {
            firstName: tenant.firstName,
            lastName: tenant.lastName,
            email: tenant.email ?? '',
            phone: tenant.phone ?? '',
            emergencyContactName: tenant.emergencyContact?.name ?? '',
            emergencyContactPhone: tenant.emergencyContact?.phone ?? '',
            emergencyContactRelationship: tenant.emergencyContact?.relationship ?? '',
            buildingId: tenant.buildingId ?? '',
            unitId: tenant.unitId ?? '',
          }
        : { firstName: '', lastName: '', email: '', phone: '', emergencyContactName: '', emergencyContactPhone: '', emergencyContactRelationship: '', buildingId: '', unitId: '' }
    );
    setLiveTenant(tenant);
    setPendingFiles([]);
    setServerError(null);
  }, [open, tenant, reset]);

  const onSubmit = async (values) => {
    setServerError(null);
    const { emergencyContactName, emergencyContactPhone, emergencyContactRelationship, buildingId, unitId, ...rest } = values;
    const body = {
      ...rest,
      emergencyContact: emergencyContactName
        ? { name: emergencyContactName, phone: emergencyContactPhone, relationship: emergencyContactRelationship || undefined }
        : null,
      buildingId: buildingId || null,
      unitId: unitId || null,
    };
    try {
      if (isEdit) {
        await tenantsApi.update(tenant.id, body);
      } else {
        const created = await tenantsApi.create(body);
        for (const file of pendingFiles) {
          await documentsApi.upload('tenant', created.data.id, file);
        }
      }
      onSaved();
      onClose();
    } catch (err) {
      setServerError(err.details?.map((d) => d.message).join(' ') || err.message);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit tenant' : 'New tenant'} size="lg">
      {serverError && <Alert variant="error" className="mb-4">{serverError}</Alert>}
      {liveTenant && !readOnly && <StatusControl tenant={liveTenant} onChanged={(updated) => { setLiveTenant(updated); onSaved(); }} />}
      {liveTenant && <ConnectionsPanel kind="tenant" id={liveTenant.id} />}
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <fieldset disabled={readOnly} className="m-0 mt-4 flex min-w-0 flex-col gap-4 border-0 p-0">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="First name" required error={errors.firstName?.message} {...register('firstName')} />
          <Field label="Last name" required error={errors.lastName?.message} {...register('lastName')} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Email" type="email" error={errors.email?.message} {...register('email')} />
          <Field label="Phone" error={errors.phone?.message} {...register('phone')} />
        </div>

        <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
          <p className="mb-3 text-sm font-medium text-slate-700 dark:text-slate-300">Residence (optional)</p>
          <ResidencePicker register={register} watch={watch} setValue={setValue} initialBuildingId={tenant?.buildingId} initialUnitId={tenant?.unitId} />
        </div>

        <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
          <p className="mb-3 text-sm font-medium text-slate-700 dark:text-slate-300">Emergency contact (optional)</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Name" error={errors.emergencyContactName?.message} {...register('emergencyContactName')} />
            <Field label="Phone" error={errors.emergencyContactPhone?.message} {...register('emergencyContactPhone')} />
            <Field label="Relationship" error={errors.emergencyContactRelationship?.message} {...register('emergencyContactRelationship')} />
          </div>
        </div>

        <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
          {isEdit ? (
            <>
              <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Photo</p>
              <MediaGallery entityType="tenant" entityId={tenant.id} canUpload canDelete />
            </>
          ) : (
            <PendingMediaPicker files={pendingFiles} onChange={setPendingFiles} label="Photo (optional)" />
          )}
        </div>

        </fieldset>
        <div className="mt-4 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>{readOnly ? 'Close' : 'Cancel'}</Button>
          {!readOnly && <Button type="submit" loading={isSubmitting}>{isEdit ? 'Save changes' : 'Create tenant'}</Button>}
        </div>
      </form>
    </Modal>
  );
}
