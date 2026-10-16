import { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal.jsx';
import { SelectField, TextareaField } from '../ui/Input.jsx';
import { Button } from '../ui/Button.jsx';
import { Alert } from '../ui/Alert.jsx';
import { dealsApi } from '../../api/deals.js';
import { END_REASONS } from '../../config/dealLabels.js';

// Ends a rental or lease (or declines a request). The house is released and goes
// back on the website; unpaid future payments are cancelled; and if the customer
// has nothing else with the company, their sign-in is switched off.
export function EndDealModal({ deal, onClose, onEnded }) {
  const pending = deal?.status === 'pending';
  const [reason, setReason] = useState('moved_out');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { if (deal) { setReason('moved_out'); setNote(''); setError(null); } }, [deal]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const res = await dealsApi.end(deal.id, { reason: pending ? 'cancelled' : reason, ...(note.trim() ? { note: note.trim() } : {}) });
      onEnded(res.data);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally { setBusy(false); }
  };

  return (
    <Modal open={Boolean(deal)} onClose={busy ? () => {} : onClose} title={pending ? 'Decline this request' : 'End this rental'} description={deal ? `${deal.subject.title}${deal.tenant ? ` — ${deal.tenant.name}` : ''}` : undefined} size="md">
      <form onSubmit={submit} className="flex flex-col gap-4">
        {error && <Alert variant="error">{error}</Alert>}
        <Alert variant="warning">
          The house becomes available again and shows on the website. Payments not yet due are cancelled. If {deal?.tenant?.name ?? 'the customer'} has no other rental, lease or request, their sign-in is closed.
        </Alert>
        {!pending && (
          <SelectField label="Why is it ending?" value={reason} onChange={(e) => setReason(e.target.value)}>
            {END_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </SelectField>
        )}
        <TextareaField label="Note (optional)" rows={3} value={note} onChange={(e) => setNote(e.target.value)} hint="The customer sees this." maxLength={500} />
        <div className="mt-1 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>Keep it</Button>
          <Button type="submit" variant="danger" loading={busy}>{pending ? 'Decline request' : 'End rental'}</Button>
        </div>
      </form>
    </Modal>
  );
}
