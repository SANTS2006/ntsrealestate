import { Field } from '../ui/Input.jsx';

// "How is this offered?" — to rent, to buy and/or on lease, each with its own
// price. Used by whole properties, buildings rented whole, and units. `prefix`
// is the form-field prefix ('rental.' on the property/building forms, none on
// the unit form); `watch` is react-hook-form's.
export function OfferFields({ register, errors, watch, prefix = '' }) {
  const e = prefix ? (errors?.[prefix.replace('.', '')] ?? {}) : (errors ?? {});
  const name = (k) => `${prefix}${k}`;
  const rent = watch(name('offerRent'));
  const sale = watch(name('offerSale'));
  const lease = watch(name('offerLease'));

  const Choice = ({ id, label, hint, children }) => (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
      <label className="flex items-start gap-2.5">
        <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-slate-600" {...register(name(id))} />
        <span className="min-w-0">
          <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">{label}</span>
          <span className="block text-xs text-slate-500 dark:text-slate-400">{hint}</span>
        </span>
      </label>
      {children}
    </div>
  );

  return (
    <fieldset className="flex min-w-0 flex-col gap-3">
      <legend className="text-sm font-medium text-slate-700 dark:text-slate-300">Offered for</legend>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Choice id="offerRent" label="Rent" hint="Paid every month">
          {rent && <Field className="mt-3" label="Rent per month" required type="number" step="0.01" min="0" error={e.monthlyRent?.message} {...register(name('monthlyRent'))} />}
        </Choice>
        <Choice id="offerSale" label="Sale" hint="Sold to a buyer">
          {sale && <Field className="mt-3" label="Sale price" required type="number" step="0.01" min="0" error={e.salePrice?.message} {...register(name('salePrice'))} />}
        </Choice>
        <Choice id="offerLease" label="Lease" hint="Long-term lease">
          {lease && (
            <div className="mt-3 flex flex-col gap-3">
              <Field label="Lease price per year" required type="number" step="0.01" min="0" error={e.leasePrice?.message} {...register(name('leasePrice'))} />
              <Field label="Lease length (months)" type="number" step="1" min="1" error={e.leaseTermMonths?.message} {...register(name('leaseTermMonths'))} />
            </div>
          )}
        </Choice>
      </div>
      {e.offerRent?.message && <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">{e.offerRent.message}</p>}
    </fieldset>
  );
}
