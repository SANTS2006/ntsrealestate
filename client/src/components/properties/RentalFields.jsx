import { Field, TextareaField } from '../ui/Input.jsx';
import { OfferFields } from './OfferFields.jsx';

// The price and details of something rented as a whole (a whole property, or
// a building in a "buildings" property). Field names are nested under
// `rental.` so the parent form submits them as one object. Facilities are
// handled by the parent (AmenityPicker) since they are a list.
export function RentalFields({ register, errors, watch, withDescription = true }) {
  const e = errors?.rental ?? {};
  return (
    <div className="flex flex-col gap-4">
      <OfferFields register={register} errors={errors} watch={watch} prefix="rental." />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Security deposit" hint="For rent and lease." type="number" step="0.01" min="0" error={e.securityDeposit?.message} {...register('rental.securityDeposit')} />
        <Field label="Type" placeholder="e.g. Villa, Bungalow, Shop" error={e.unitType?.message} {...register('rental.unitType')} />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Field label="Bedrooms" type="number" step="1" min="0" error={e.bedrooms?.message} {...register('rental.bedrooms')} />
        <Field label="Bathrooms" type="number" step="1" min="0" error={e.bathrooms?.message} {...register('rental.bathrooms')} />
        <Field label="Area (sq ft)" type="number" step="any" min="0" error={e.area?.message} {...register('rental.area')} />
        <Field label="Floors / level" type="number" step="1" error={e.floor?.message} {...register('rental.floor')} />
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
        <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-slate-600" {...register('rental.furnished')} />
        Furnished
      </label>
      {withDescription && <TextareaField label="About this place" hint="What makes it a good home — shown on the public listing." error={e.description?.message} {...register('rental.description')} />}
    </div>
  );
}

export const EMPTY_RENTAL = { offerRent: true, offerSale: false, offerLease: false, monthlyRent: '', salePrice: '', leasePrice: '', leaseTermMonths: '12', securityDeposit: '', unitType: '', bedrooms: '', bathrooms: '', area: '', floor: '', furnished: false, description: '' };

export function rentalToForm(r) {
  if (!r) return { ...EMPTY_RENTAL };
  return {
    offerRent: r.offerRent ?? true, offerSale: Boolean(r.offerSale), offerLease: Boolean(r.offerLease), monthlyRent: r.monthlyRent ?? '',
    salePrice: r.salePrice ?? '', leasePrice: r.leasePrice ?? '', leaseTermMonths: r.leaseTermMonths ?? '12', securityDeposit: r.securityDeposit ?? '', unitType: r.unitType ?? '', bedrooms: r.bedrooms ?? '',
    bathrooms: r.bathrooms ?? '', area: r.area ?? '', floor: r.floor ?? '', furnished: Boolean(r.furnished), description: r.description ?? '',
  };
}

// Form values -> API payload (empty strings dropped, numbers left for the server to coerce).
export function rentalPayload(values, amenities) {
  const out = { amenities };
  for (const [k, v] of Object.entries(values ?? {})) {
    if (v === '' || v === undefined || v === null) continue;
    out[k] = v;
  }
  return out;
}
