import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '../ui/Modal.jsx';
import { Field, TextareaField } from '../ui/Input.jsx';
import { Button } from '../ui/Button.jsx';
import { Alert } from '../ui/Alert.jsx';
import { MediaGallery } from '../media/MediaGallery.jsx';
import { PendingMediaPicker } from '../media/PendingMediaPicker.jsx';
import { AmenityPicker } from './AmenityPicker.jsx';
import { OfferFields } from './OfferFields.jsx';
import { unitsApi } from '../../api/units.js';
import { documentsApi } from '../../api/documents.js';
import { unitFormSchema } from '../../validations/unit.js';

export function UnitFormModal({ open, onClose, onSaved, buildingId, unit }) {
  const isEdit = Boolean(unit);
  const [serverError, setServerError] = useState(null);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [amenities, setAmenities] = useState([]);
  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(unitFormSchema) });

  useEffect(() => {
    if (!open) return;
    reset(
      unit
        ? {
            unitNumber: unit.unitNumber,
            unitType: unit.unitType ?? '',
            floor: unit.floor ?? '',
            bedrooms: unit.bedrooms ?? '',
            bathrooms: unit.bathrooms ?? '',
            area: unit.area ?? '',
            monthlyRent: unit.monthlyRent,
            offerRent: unit.offerRent ?? true,
            offerSale: Boolean(unit.offerSale),
            offerLease: Boolean(unit.offerLease),
            salePrice: unit.salePrice ?? '',
            leasePrice: unit.leasePrice ?? '',
            leaseTermMonths: unit.leaseTermMonths ?? '12',
            securityDeposit: unit.securityDeposit ?? '',
            description: unit.description ?? '',
            furnished: Boolean(unit.furnished),
            isShared: Boolean(unit.isShared),
          }
        : { unitNumber: '', unitType: '', floor: '', bedrooms: '', bathrooms: '', area: '', monthlyRent: '', offerRent: true, offerSale: false, offerLease: false, salePrice: '', leasePrice: '', leaseTermMonths: '12', securityDeposit: '', description: '', furnished: false, isShared: false }
    );
    setAmenities(unit?.amenities ?? []);
    setPendingFiles([]);
    setServerError(null);
  }, [open, unit, reset]);

  const onSubmit = async (values) => {
    setServerError(null);
    try {
      const body = { ...values, furnished: Boolean(values.furnished), isShared: Boolean(values.isShared), amenities };
      for (const k of ['monthlyRent', 'salePrice', 'leasePrice', 'leaseTermMonths']) if (body[k] === undefined) delete body[k];
      if (isEdit) {
        await unitsApi.update(unit.id, body);
      } else {
        const created = await unitsApi.create(buildingId, body);
        for (const file of pendingFiles) {
          try { await documentsApi.upload('unit', created.data.id, file); } catch { /* the unit is saved; photos can be added by editing */ }
        }
      }
      onSaved();
      onClose();
    } catch (err) {
      setServerError(err.details?.map((d) => d.message).join(' ') || err.message);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? (unit.isWhole ? 'Edit price and details' : 'Edit unit') : 'New unit'} size="lg">
      {serverError && <Alert variant="error" className="mb-4">{serverError}</Alert>}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {!unit?.isWhole && <Field label="Unit number" required error={errors.unitNumber?.message} {...register('unitNumber')} />}
          <Field label="Unit type" placeholder="e.g. Studio, 2BR" error={errors.unitType?.message} {...register('unitType')} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Floor" type="number" step="1" error={errors.floor?.message} {...register('floor')} />
          <Field label="Bedrooms" type="number" step="1" error={errors.bedrooms?.message} {...register('bedrooms')} />
          <Field label="Bathrooms" type="number" step="1" error={errors.bathrooms?.message} {...register('bathrooms')} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Area (sq ft)" type="number" step="any" error={errors.area?.message} {...register('area')} />
          <Field label="Security deposit" type="number" step="0.01" error={errors.securityDeposit?.message} {...register('securityDeposit')} />
        </div>
        <OfferFields register={register} errors={errors} watch={watch} />
        <label className="flex items-start gap-2.5 rounded-lg bg-slate-50 p-3 text-sm text-slate-700 dark:bg-slate-800/50 dark:text-slate-300">
          <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-slate-600" {...register('isShared')} />
          <span><span className="font-medium">Shared</span> — this unit can be rented by more than one person. Leave it off and it goes to one renter only, then shows as rented.</span>
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-slate-600" {...register('furnished')} />
          Furnished
        </label>
        <AmenityPicker value={amenities} onChange={setAmenities} hint="What comes with this unit?" />
        <TextareaField label="Description" error={errors.description?.message} {...register('description')} />

        <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
          {isEdit ? (
            <>
              <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Photos &amp; videos</p>
              <MediaGallery entityType="unit" entityId={unit.id} canUpload canDelete />
            </>
          ) : (
            <PendingMediaPicker files={pendingFiles} onChange={setPendingFiles} label="Photos or videos (optional)" />
          )}
        </div>

        <div className="mt-2 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>{isEdit ? 'Save changes' : 'Create unit'}</Button>
        </div>
      </form>
    </Modal>
  );
}
