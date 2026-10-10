import { useState } from 'react';
import { Paperclip } from 'lucide-react';
import { Button } from '../ui/Button.jsx';
import { Modal } from '../ui/Modal.jsx';
import { MediaGallery } from './MediaGallery.jsx';

// Small "attach a document" affordance for ledger-style records (leases,
// invoices, payments, expenses) that get a receipt/scan attached rather
// than a cover photo — an icon button that opens the same MediaGallery
// used everywhere else, in a modal, instead of a dedicated form field.
export function DocumentsButton({ entityType, entityId, canUpload, canDelete, title, label = 'Documents' }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)} aria-label={label}>
        <Paperclip size={14} aria-hidden="true" />
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={title ?? label} size="lg">
        <MediaGallery entityType={entityType} entityId={entityId} canUpload={canUpload} canDelete={canDelete} />
      </Modal>
    </>
  );
}
