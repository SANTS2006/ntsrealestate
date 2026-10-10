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
import { RentalFields, EMPTY_RENTAL, rentalToForm, rentalPayload } from './RentalFields.jsx';
import { buildingsApi } from '../../api/buildings.js';
import { documentsApi } from '../../api/documents.js';
import { buildingFormSchema, buildingWithRentalFormSchema } from '../../validations/building.js';

// `structureType` is the property's: in a "buildings" property each building
// is rented as a whole, so it also carries a price, bedrooms, bathrooms and
// facilities; in a "buildings with units" property those live on its units.
export function BuildingFormModal({ open, onClose, onSaved, propertyId, building, structureType }) {
  const isEdit = Boolean(building);
  const rentable = structureType === 'buildings';
  const [serverError, setServerError] = useState(null);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [amenities, setAmenities] = useState([]);
  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(rentable ? buildingWithRentalFormSchema : buildingFormSchema),
  });

  useEffect(() => {
    if (!open) return;
    reset(
      building
        ? { name: building.name, code: building.code ?? '', floors: building.floors ?? '', description: building.description ?? '', isShared: Boolean(building.isShared), rental: rentalToForm(building.rental) }
        : { name: '', code: '', floors: '', description: '', isShared: false, rental: { ...EMPTY_RENTAL } }
    );
    setAmenities(building?.rental?.amenities ?? []);
    setPendingFiles([]);
    setServerError(null);
  }, [open, building, reset]);

  const onSubmit = async (values) => {
    setServerError(null);
    try {
      const { rental, ...fields } = values;
      const body = rentable ? { ...fields, rental: rentalPayload(rental, amenities) } : fields;
      if (isEdit) {
        await buildingsApi.update(building.id, body);
      } else {
        const created = await buildingsApi.create(propertyId, body);
        for (const file of pendingFiles) {
          try { await documentsApi.upload('building', created.data.id, file); } catch { /* the building is saved; photos can be added by editing */ }
        }
      }
      onSaved();
      onClose();
    } catch (err) {
      setServerError(err.details?.map((d) => d.message).join(' ') || err.message);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit building' : 'New building'} size="lg">
      {serverError && <Alert variant="error" className="mb-4">{serverError}</Alert>}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex min-w-0 flex-col gap-4">
        <Field label="Building name" required error={errors.name?.message} {...register('name')} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Code" error={errors.code?.message} {...register('code')} />
          <Field label="Floors" type="number" step="1" error={errors.floors?.message} {...register('floors')} />
        </div>
        <TextareaField label="Description" error={errors.description?.message} {...register('description')} />

        <label className="flex items-start gap-2.5 rounded-lg bg-slate-50 p-3 text-sm text-slate-700 dark:bg-slate-800/50 dark:text-slate-300">
          <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-slate-600" {...register('isShared')} />
          <span><span className="font-medium">Shared</span> — this building can be rented by more than one person. Leave it off and it goes to one renter only, then shows as rented.</span>
        </label>

        {rentable && (
          <section className="flex flex-col gap-4 rounded-xl border border-brand-200 bg-brand-50/40 p-4 dark:border-brand-900 dark:bg-brand-950/20">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Price and details</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">This building is rented as a whole. Tenants see these details on the listing.</p>
            </div>
            <RentalFields register={register} errors={errors} watch={watch} withDescription={false} />
            <AmenityPicker value={amenities} onChange={setAmenities} hint="What does the building come with?" />
          </section>
        )}

        <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
          {isEdit ? (
            <>
              <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Photos &amp; videos</p>
              <MediaGallery entityType="building" entityId={building.id} canUpload canDelete />
            </>
          ) : (
            <PendingMediaPicker files={pendingFiles} onChange={setPendingFiles} label="Photos or videos (optional)" />
          )}
        </div>

        <div className="mt-2 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>{isEdit ? 'Save changes' : 'Create building'}</Button>
        </div>
      </form>
    </Modal>
  );
}
