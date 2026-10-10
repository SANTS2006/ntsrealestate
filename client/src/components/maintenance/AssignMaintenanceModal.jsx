import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Phone, Star } from 'lucide-react';
import { Modal } from '../ui/Modal.jsx';
import { Button } from '../ui/Button.jsx';
import { Alert } from '../ui/Alert.jsx';
import { Spinner } from '../ui/Spinner.jsx';
import { maintenanceApi } from '../../api/maintenance.js';

// Hand a maintenance request to a vendor. The vendors whose service fits the
// request are listed first; the vendor and the tenant are both emailed.
export function AssignMaintenanceModal({ open, onClose, onSaved, request }) {
  const [vendors, setVendors] = useState(null);
  const [vendorId, setVendorId] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !request) return;
    setVendors(null);
    setVendorId('');
    setError(null);
    maintenanceApi.vendors(request.id).then((res) => setVendors(res.data)).catch((err) => { setError(err.message); setVendors([]); });
  }, [open, request]);

  if (!request) return null;
  const chosen = vendors?.find((v) => v.id === vendorId);

  const submit = async (e) => {
    e.preventDefault();
    if (!vendorId) { setError('Choose a vendor.'); return; }
    setBusy(true);
    setError(null);
    try {
      await maintenanceApi.assign(request.id, vendorId);
      onSaved();
      onClose();
    } catch (err) {
      setError(err.details?.map((d) => d.message).join(' ') || err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Assign to a vendor" description={request.title}>
      {error && <Alert variant="error" className="mb-4">{error}</Alert>}
      {vendors === null ? (
        <div className="py-8"><Spinner label="Loading vendors…" /></div>
      ) : vendors.length === 0 ? (
        <div className="flex flex-col gap-3 text-sm text-slate-600 dark:text-slate-300">
          <p>There are no active vendors yet. Add the plumber, electrician or other contractor first.</p>
          <Link to="/vendors" className="font-medium text-brand-600 hover:underline dark:text-brand-400" onClick={onClose}>Go to Vendors</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="flex min-w-0 flex-col gap-4">
          <fieldset className="flex max-h-72 flex-col gap-2 overflow-y-auto pr-1">
            <legend className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">Vendor <span className="text-rose-500" aria-hidden="true">*</span></legend>
            {vendors.map((v) => (
              <label key={v.id} className={`flex min-w-0 cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition-colors ${vendorId === v.id ? 'border-brand-500 bg-brand-50/60 dark:bg-brand-950/30' : 'border-slate-200 hover:border-slate-300 dark:border-slate-700'}`}>
                <input type="radio" name="vendor" value={v.id} checked={vendorId === v.id} onChange={() => setVendorId(v.id)} className="mt-1 h-4 w-4 text-brand-600 focus:ring-brand-500" />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-900 dark:text-slate-100">{v.name}</span>
                    {v.suggested && <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300"><Star size={11} aria-hidden="true" />Fits this request</span>}
                  </span>
                  {v.serviceType && <span className="block text-xs text-slate-500 dark:text-slate-400">{v.serviceType}</span>}
                </span>
              </label>
            ))}
          </fieldset>

          {chosen && (
            <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-800/50 dark:text-slate-300">
              <p className="mb-1 font-medium text-slate-900 dark:text-slate-100">They and the tenant will be emailed.</p>
              {chosen.email ? <p className="flex items-center gap-1.5 break-all"><Mail size={12} aria-hidden="true" />{chosen.email}</p> : <p className="text-amber-600 dark:text-amber-400">This vendor has no email on file, so only the tenant is emailed.</p>}
              {chosen.phone && <p className="mt-0.5 flex items-center gap-1.5"><Phone size={12} aria-hidden="true" />{chosen.phone}</p>}
            </div>
          )}

          <div className="mt-1 flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={busy}>Assign vendor</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
