import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from '../ui/Modal.jsx';
import { Field, SelectField, TextareaField } from '../ui/Input.jsx';
import { Button } from '../ui/Button.jsx';
import { Alert } from '../ui/Alert.jsx';
import { MediaGallery } from '../media/MediaGallery.jsx';
import { PendingMediaPicker } from '../media/PendingMediaPicker.jsx';
import { AmenityPicker } from '../properties/AmenityPicker.jsx';
import { landsApi } from '../../api/lands.js';
import { ownersApi } from '../../api/owners.js';
import { documentsApi } from '../../api/documents.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { LAND_TYPES, AREA_UNITS, LAND_FEATURES } from '../../config/dealLabels.js';

const empty = (v) => (v === '' || v === null || v === undefined ? undefined : v);
const optText = (max) => z.preprocess(empty, z.string().trim().max(max).optional());
const optNum = (schema) => z.preprocess(empty, schema.optional());

const schema = z.object({
  title: z.string().trim().min(1, 'Give the land a title.').max(200),
  landType: z.enum(['residential', 'commercial', 'agricultural', 'industrial', 'mixed_use', 'other']),
  area: z.coerce.number({ invalid_type_error: 'Enter the size.' }).positive('Enter the size.'),
  areaUnit: z.enum(['acres', 'hectares', 'sqm', 'plots']),
  price: z.coerce.number({ invalid_type_error: 'Enter the price.' }).positive('Enter the price.'),
  description: optText(4000),
  region: optText(100),
  city: optText(100),
  country: optText(100),
  address: optText(300),
  latitude: optNum(z.coerce.number().min(-90).max(90)),
  longitude: optNum(z.coerce.number().min(-180).max(180)),
  titleDocument: optText(200),
  ownerId: optText(100),
});

const TITLE_DOCS = ['Registered title deed', 'Survey plan', 'Family / customary land', 'Government lease', 'Sale agreement only'];

// Add or edit a land with all its specifications, photos and videos.
export function LandFormModal({ open, onClose, onSaved, land }) {
  const isEdit = Boolean(land);
  const { hasRole } = useAuth();
  const isAdmin = hasRole('administrator');
  const [serverError, setServerError] = useState(null);
  const [features, setFeatures] = useState([]);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [owners, setOwners] = useState([]);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!open || !isAdmin) return;
    ownersApi.options().then((res) => setOwners(res.data)).catch(() => {});
  }, [open, isAdmin]);

  useEffect(() => {
    if (!open) return;
    reset(land
      ? {
          title: land.title, landType: land.landType, area: land.area, areaUnit: land.areaUnit, price: land.price,
          description: land.description ?? '', region: land.region ?? '', city: land.city ?? '', country: land.country ?? '',
          address: land.address ?? '', latitude: land.latitude ?? '', longitude: land.longitude ?? '', titleDocument: land.titleDocument ?? '', ownerId: land.ownerId ?? '',
        }
      : { title: '', landType: 'residential', area: '', areaUnit: 'acres', price: '', description: '', region: '', city: '', country: '', address: '', latitude: '', longitude: '', titleDocument: '', ownerId: '' });
    setFeatures(land?.features ?? []);
    setPendingFiles([]);
    setServerError(null);
  }, [open, land, reset]);

  const onSubmit = async (values) => {
    setServerError(null);
    const body = { ...values, features, ownerId: values.ownerId || null };
    try {
      if (isEdit) {
        await landsApi.update(land.id, body);
      } else {
        const created = await landsApi.create(body);
        let failed = 0;
        for (const file of pendingFiles) {
          try { await documentsApi.upload('land', created.data.id, file); } catch { failed += 1; }
        }
        if (failed > 0) {
          onSaved(created.data);
          setServerError(`The land was saved, but ${failed} file${failed === 1 ? '' : 's'} could not be uploaded. Close this window and add them by editing the land.`);
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

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit land' : 'Add land'} description="Specifications, photos and videos. Available lands appear on the website for people to buy." size="lg">
      {serverError && <Alert variant="error" className="mb-4">{serverError}</Alert>}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex min-w-0 flex-col gap-4">
        <Field label="Title" required placeholder="e.g. Corner plot near Bo Town" error={errors.title?.message} {...register('title')} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField label="Type of land" required error={errors.landType?.message} {...register('landType')}>
            {LAND_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </SelectField>
          <Field label="Price" required type="number" step="0.01" min="0" error={errors.price?.message} {...register('price')} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Size" required type="number" step="any" min="0" error={errors.area?.message} {...register('area')} />
          <SelectField label="Measured in" required error={errors.areaUnit?.message} {...register('areaUnit')}>
            {AREA_UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
          </SelectField>
        </div>
        <TextareaField label="Description" hint="What buyers should know about the land." error={errors.description?.message} {...register('description')} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Region / State" error={errors.region?.message} {...register('region')} />
          <Field label="City / Town" error={errors.city?.message} {...register('city')} />
          <Field label="Country" error={errors.country?.message} {...register('country')} />
        </div>
        <Field label="Exact location" hint="Only people who manage lands see this. The website shows just the city and region." error={errors.address?.message} {...register('address')} />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Latitude" type="number" step="any" error={errors.latitude?.message} {...register('latitude')} />
          <Field label="Longitude" type="number" step="any" error={errors.longitude?.message} {...register('longitude')} />
        </div>

        <Field label="Land documents" list="land-title-docs" hint="What paperwork backs this land?" error={errors.titleDocument?.message} {...register('titleDocument')} />
        <datalist id="land-title-docs">{TITLE_DOCS.map((d) => <option key={d} value={d} />)}</datalist>

        {isAdmin && (
          <SelectField label="Belongs to" hint="Optional — the owner this land is sold for. Leave empty if the company holds it." error={errors.ownerId?.message} {...register('ownerId')}>
            <option value="">The company</option>
            {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </SelectField>
        )}

        <AmenityPicker label="Features" hint="Tap everything that applies." options={LAND_FEATURES} value={features} onChange={setFeatures} placeholder="Add another feature…" />

        <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
          {isEdit ? (
            <>
              <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Photos &amp; videos</p>
              <MediaGallery entityType="land" entityId={land.id} canUpload canDelete />
            </>
          ) : (
            <PendingMediaPicker files={pendingFiles} onChange={setPendingFiles} label="Photos or videos of the land (optional)" />
          )}
        </div>

        <div className="mt-2 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>{isEdit ? 'Save changes' : 'Add land'}</Button>
        </div>
      </form>
    </Modal>
  );
}
