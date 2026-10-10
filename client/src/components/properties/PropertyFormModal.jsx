import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Check } from 'lucide-react';
import clsx from 'clsx';
import { Modal } from '../ui/Modal.jsx';
import { Field, SelectField, TextareaField } from '../ui/Input.jsx';
import { Button } from '../ui/Button.jsx';
import { Alert } from '../ui/Alert.jsx';
import { Badge } from '../ui/Badge.jsx';
import { MediaGallery } from '../media/MediaGallery.jsx';
import { PendingMediaPicker } from '../media/PendingMediaPicker.jsx';
import { AmenityPicker } from './AmenityPicker.jsx';
import { RentalFields, EMPTY_RENTAL, rentalPayload } from './RentalFields.jsx';
import { propertiesApi } from '../../api/properties.js';
import { ownersApi } from '../../api/owners.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { documentsApi } from '../../api/documents.js';
import { propertyFormSchema, wholePropertyFormSchema } from '../../validations/property.js';
import { PROPERTY_STRUCTURES, structureOf } from '../../config/propertyStructures.js';

const PROPERTY_TYPES = ['Residential', 'Commercial', 'Mixed-use', 'Industrial', 'Land'];

// Step 1 of adding a property: how is it organised?
function StructureChoice({ onChoose }) {
  return (
    <div>
      <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">What kind of property are you adding? This decides what you fill in next.</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {PROPERTY_STRUCTURES.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => onChoose(s.key)}
            className="group flex min-w-0 flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-brand-400 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-500"
          >
            <span className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 group-hover:bg-brand-100 dark:bg-brand-950 dark:text-brand-400">
                <s.icon size={20} aria-hidden="true" />
              </span>
              <span className="min-w-0 font-semibold text-slate-900 dark:text-slate-100">{s.label}</span>
            </span>
            <span className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">{s.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function PropertyFormModal({ open, onClose, onSaved, property }) {
  const isEdit = Boolean(property);
  const [structure, setStructure] = useState(null); // chosen on step 1 when adding
  const [amenities, setAmenities] = useState([]);
  const [rentalAmenities, setRentalAmenities] = useState([]);
  const [serverError, setServerError] = useState(null);
  const [pendingFiles, setPendingFiles] = useState([]);
  const { hasRole } = useAuth();
  // Administrators pick from every owner in the system; agents pick from the
  // owners they are linked to (the server only returns those); an owner adding
  // a property never picks — it is tagged to them automatically when saved.
  const pickOwner = !isEdit && (hasRole('administrator') || hasRole('agent'));
  const ownerRequired = pickOwner && !hasRole('administrator');
  const [owners, setOwners] = useState(null);
  const isWhole = structure === 'whole';
  const { register, handleSubmit, reset, setError, watch, formState: { errors, isSubmitting } } = useForm({
    resolver: (values, ctx, opts) => zodResolver(isWhole ? wholePropertyFormSchema : propertyFormSchema)(values, ctx, opts),
  });

  useEffect(() => {
    if (!open || !pickOwner) return;
    setOwners(null);
    ownersApi.options().then((res) => setOwners(res.data)).catch(() => setOwners([]));
  }, [open, pickOwner]);

  useEffect(() => {
    if (!open) return;
    reset(
      property
        ? {
            propertyCode: property.propertyCode,
            name: property.name,
            propertyType: property.propertyType,
            description: property.description ?? '',
            address: property.address,
            city: property.city ?? '',
            region: property.region ?? '',
            country: property.country ?? '',
            latitude: property.latitude ?? '',
            longitude: property.longitude ?? '',
            yearBuilt: property.yearBuilt ?? '',
            isShared: Boolean(property.isShared),
          }
        : { propertyCode: '', name: '', propertyType: '', description: '', address: '', city: '', region: '', country: '', latitude: '', longitude: '', yearBuilt: '', ownerId: '', isShared: false, rental: { ...EMPTY_RENTAL } }
    );
    setStructure(property ? property.structureType : null);
    setAmenities(property?.amenities ?? []);
    setRentalAmenities([]);
    setPendingFiles([]);
    setServerError(null);
  }, [open, property, reset]);

  const onSubmit = async (values) => {
    setServerError(null);
    if (ownerRequired && !values.ownerId) {
      setError('ownerId', { message: 'Choose which owner this property belongs to.' });
      return;
    }
    try {
      if (isEdit) {
        // eslint-disable-next-line no-unused-vars
        const { propertyCode, ownerId, rental, ...updatable } = values;
        await propertiesApi.update(property.id, { ...updatable, amenities });
      } else {
        const { rental, ...rest } = values;
        const created = await propertiesApi.create({
          ...rest,
          ownerId: pickOwner ? values.ownerId : undefined,
          structureType: structure,
          ...(isWhole ? { rental: rentalPayload(rental, rentalAmenities) } : { amenities }),
        });
        // The property now exists, so a failed photo/video must not look like a
        // failed save (retrying would hit "property code already exists").
        let failedFiles = 0;
        for (const file of pendingFiles) {
          try { await documentsApi.upload('property', created.data.id, file); } catch { failedFiles += 1; }
        }
        if (failedFiles > 0) {
          onSaved();
          setServerError(`The property was saved, but ${failedFiles} file${failedFiles === 1 ? '' : 's'} could not be uploaded. Close this window and add them by editing the property.`);
          return;
        }
        onSaved(created.data);
        onClose();
        return;
      }
      onSaved();
      onClose();
    } catch (err) {
      setServerError(err.details?.map((d) => d.message).join(' ') || err.message);
    }
  };

  const chosen = structure ? structureOf(structure) : null;

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit property' : 'New property'} description={!isEdit && !structure ? 'Step 1 of 2 — choose the kind of property' : undefined} size="lg">
      {serverError && <Alert variant="error" className="mb-4">{serverError}</Alert>}

      {!isEdit && !structure ? (
        <StructureChoice onChoose={setStructure} />
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex min-w-0 flex-col gap-4">
          {chosen && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2.5 dark:bg-slate-800/50">
              <span className="flex min-w-0 items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <chosen.icon size={16} className="shrink-0 text-brand-600 dark:text-brand-400" aria-hidden="true" />
                <span className="truncate font-medium">{chosen.label}</span>
                {isEdit && <Badge tone="neutral">cannot be changed</Badge>}
              </span>
              {!isEdit && (
                <button type="button" onClick={() => setStructure(null)} className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline dark:text-brand-400">
                  <ArrowLeft size={12} aria-hidden="true" />Change type
                </button>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Property code" required disabled={isEdit} hint={isEdit ? 'Property code cannot be changed.' : undefined} error={errors.propertyCode?.message} {...register('propertyCode')} />
            <Field label="Property category" required list="property-types" error={errors.propertyType?.message} {...register('propertyType')} />
            <datalist id="property-types">
              {PROPERTY_TYPES.map((t) => <option key={t} value={t} />)}
            </datalist>
          </div>
          {pickOwner && (
            <SelectField
              label="Owner"
              required={ownerRequired}
              hint={owners && owners.length === 0
                ? (ownerRequired ? 'You are not linked to any owner yet. Ask an owner or administrator to add you.' : 'No owners are registered yet.')
                : (ownerRequired ? 'The owner this property belongs to — one of the owners you work for.' : 'Optional — choose who owns this property.')}
              error={errors.ownerId?.message}
              disabled={owners === null}
              {...register('ownerId')}
            >
              <option value="">{owners === null ? 'Loading owners…' : ownerRequired ? 'Select an owner…' : 'No owner yet'}</option>
              {(owners ?? []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </SelectField>
          )}
          <Field label="Property name" required error={errors.name?.message} {...register('name')} />
          <TextareaField label="Description" error={errors.description?.message} {...register('description')} />
          <Field label="Address" required error={errors.address?.message} {...register('address')} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="City" error={errors.city?.message} {...register('city')} />
            <Field label="Region / State" error={errors.region?.message} {...register('region')} />
            <Field label="Country" error={errors.country?.message} {...register('country')} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Latitude" type="number" step="any" error={errors.latitude?.message} {...register('latitude')} />
            <Field label="Longitude" type="number" step="any" error={errors.longitude?.message} {...register('longitude')} />
            <Field label="Year built" type="number" step="1" error={errors.yearBuilt?.message} {...register('yearBuilt')} />
          </div>

        <label className="flex items-start gap-2.5 rounded-lg bg-slate-50 p-3 text-sm text-slate-700 dark:bg-slate-800/50 dark:text-slate-300">
          <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-slate-600" {...register('isShared')} />
          <span><span className="font-medium">Shared</span> — this property can be rented by more than one person. Leave it off and it goes to one renter only, then shows as rented.</span>
        </label>

          {isWhole && !isEdit && (
            <section className="flex flex-col gap-4 rounded-xl border border-brand-200 bg-brand-50/40 p-4 dark:border-brand-900 dark:bg-brand-950/20">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Price and details</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">This is what tenants see when they browse the listing.</p>
              </div>
              <RentalFields register={register} errors={errors} watch={watch} />
              <AmenityPicker value={rentalAmenities} onChange={setRentalAmenities} hint="What does the property come with?" />
            </section>
          )}

          {!isWhole && (
            <AmenityPicker label="Shared facilities" hint="Facilities everyone on the property shares (optional)." value={amenities} onChange={setAmenities} />
          )}

          {!isEdit && chosen && structure !== 'whole' && (
            <p className="flex items-start gap-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-800 dark:bg-brand-950/40 dark:text-brand-200">
              <Check size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>Next: {chosen.next.toLowerCase()}. You will find it on the property page.</span>
            </p>
          )}

          <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
            {isEdit ? (
              <>
                <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Photos &amp; videos</p>
                <MediaGallery entityType="property" entityId={property.id} canUpload canDelete />
              </>
            ) : (
              <PendingMediaPicker files={pendingFiles} onChange={setPendingFiles} label="Photos or videos (optional)" />
            )}
          </div>

          <div className={clsx('mt-2 flex justify-end gap-3')}>
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={isSubmitting}>{isEdit ? 'Save changes' : 'Create property'}</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
