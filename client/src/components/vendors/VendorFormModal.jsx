import { useEffect, useState } from 'react';
import { hasPermission } from '../../config/capabilities.js';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '../ui/Modal.jsx';
import { Field } from '../ui/Input.jsx';
import { Button } from '../ui/Button.jsx';
import { Alert } from '../ui/Alert.jsx';
import { ConfirmDialog } from '../ui/ConfirmDialog.jsx';
import { MediaGallery } from '../media/MediaGallery.jsx';
import { PendingMediaPicker } from '../media/PendingMediaPicker.jsx';
import { vendorsApi } from '../../api/vendors.js';
import { documentsApi } from '../../api/documents.js';
import { vendorFormSchema } from '../../validations/vendor.js';

const VENDOR_STATUSES = ['active', 'inactive'];

function StatusControl({ vendor, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = async (e) => {
    setError(null);
    setBusy(true);
    try {
      const updated = await vendorsApi.setStatus(vendor.id, e.target.value);
      onChanged(updated.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-4 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5 dark:bg-slate-800/50">
      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Status</p>
      <div className="flex items-center gap-2">
        {error && <span className="text-xs text-rose-600 dark:text-rose-400">{error}</span>}
        <select
          value={vendor.status}
          onChange={handleChange}
          disabled={busy}
          className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          {VENDOR_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
    </div>
  );
}

export function VendorFormModal({ open, onClose, onSaved, vendor }) {
  const isEdit = Boolean(vendor);
  // Opening an existing vendor without permission to change it shows it read-only.
  const readOnly = isEdit && !hasPermission('vendors:update');
  const canDelete = isEdit && hasPermission('vendors:delete');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [serverError, setServerError] = useState(null);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [liveVendor, setLiveVendor] = useState(vendor);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(vendorFormSchema) });

  useEffect(() => {
    if (!open) return;
    reset(
      vendor
        ? { name: vendor.name, contactPerson: vendor.contactPerson ?? '', email: vendor.email ?? '', phone: vendor.phone ?? '', address: vendor.address ?? '', serviceType: vendor.serviceType ?? '' }
        : { name: '', contactPerson: '', email: '', phone: '', address: '', serviceType: '' }
    );
    setLiveVendor(vendor);
    setPendingFiles([]);
    setServerError(null);
  }, [open, vendor, reset]);

  const onSubmit = async (values) => {
    setServerError(null);
    try {
      if (isEdit) {
        await vendorsApi.update(vendor.id, values);
      } else {
        const created = await vendorsApi.create(values);
        for (const file of pendingFiles) {
          await documentsApi.upload('vendor', created.data.id, file);
        }
      }
      onSaved();
      onClose();
    } catch (err) {
      setServerError(err.details?.map((d) => d.message).join(' ') || err.message);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={readOnly ? 'Vendor' : isEdit ? 'Edit vendor' : 'New vendor'} size="lg">
      {serverError && <Alert variant="error" className="mb-4">{serverError}</Alert>}
      {liveVendor && !readOnly && <StatusControl vendor={liveVendor} onChanged={(updated) => { setLiveVendor(updated); onSaved(); }} />}
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <fieldset disabled={readOnly} className="m-0 flex min-w-0 flex-col gap-4 border-0 p-0">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Vendor name" required error={errors.name?.message} {...register('name')} />
          <Field label="Service type" placeholder="e.g. Plumbing, Electrical" error={errors.serviceType?.message} {...register('serviceType')} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Contact person" error={errors.contactPerson?.message} {...register('contactPerson')} />
          <Field label="Phone" error={errors.phone?.message} {...register('phone')} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Email" type="email" error={errors.email?.message} {...register('email')} />
          <Field label="Address" error={errors.address?.message} {...register('address')} />
        </div>
        <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
          {isEdit ? (
            <>
              <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Photo &amp; documents</p>
              <MediaGallery entityType="vendor" entityId={vendor.id} canUpload canDelete />
            </>
          ) : (
            <PendingMediaPicker files={pendingFiles} onChange={setPendingFiles} label="Photo or documents (optional)" />
          )}
        </div>

        </fieldset>
        <div className="mt-4 flex items-center justify-end gap-3">
          {canDelete && (
            <Button type="button" variant="danger" className="mr-auto" onClick={() => setConfirmDelete(true)}>Delete vendor</Button>
          )}
          <Button type="button" variant="secondary" onClick={onClose}>{readOnly ? 'Close' : 'Cancel'}</Button>
          {!readOnly && <Button type="submit" loading={isSubmitting}>{isEdit ? 'Save changes' : 'Create vendor'}</Button>}
        </div>
      </form>
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => { await vendorsApi.remove(vendor.id); onSaved(); onClose(); }}
        title="Delete vendor?"
        description={`Permanently delete ${vendor?.name ?? 'this vendor'} and its files. Past work orders and expenses keep their amounts but no longer show this vendor. This cannot be undone.`}
        confirmLabel="Delete"
      />
    </Modal>
  );
}
