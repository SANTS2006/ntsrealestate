import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Image as ImageIcon, Film, Upload, Trash2, AlertTriangle, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../ui/Button.jsx';
import { Spinner } from '../ui/Spinner.jsx';
import { Alert } from '../ui/Alert.jsx';
import { ConfirmDialog } from '../ui/ConfirmDialog.jsx';
import { documentsApi } from '../../api/documents.js';

const ACCEPT = '.jpg,.jpeg,.png,.webp,.mp4,.mov';

function useSignedUrl(doc) {
  const [url, setUrl] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    setUrl(null);
    setError(null);
    documentsApi.getAccessUrl(doc.id)
      .then((res) => { if (!cancelled) setUrl(res.data.url); })
      .catch((err) => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [doc]);

  return { url, error };
}

// Full-screen viewer for a gallery's documents, with prev/next navigation —
// gives properties/buildings/units/tenants/owners a consistent "modern"
// media-viewing experience without duplicating this per entity type.
function Lightbox({ documents, index, onClose, onNavigate }) {
  const doc = documents[index];
  const { url, error } = useSignedUrl(doc);
  const isVideo = doc.mimeType?.startsWith('video/');

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onNavigate(-1);
      if (e.key === 'ArrowRight') onNavigate(1);
    }
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [onClose, onNavigate]);

  return createPortal(
    <div className="fixed inset-0 z-[60] flex flex-col bg-slate-950/95" role="dialog" aria-modal="true">
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <span className="truncate text-sm">{doc.originalFilename}</span>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 hover:bg-white/10">
          <X size={20} aria-hidden="true" />
        </button>
      </div>
      <div className="relative flex flex-1 items-center justify-center px-4 pb-6">
        {documents.length > 1 && (
          <button
            type="button"
            onClick={() => onNavigate(-1)}
            aria-label="Previous"
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 sm:left-6"
          >
            <ChevronLeft size={22} aria-hidden="true" />
          </button>
        )}
        {!url && !error && <Spinner size={24} className="text-white" />}
        {error && <p className="text-sm text-slate-300">Preview unavailable.</p>}
        {url && isVideo && <video src={url} className="max-h-full max-w-full rounded-lg" controls autoPlay />}
        {url && !isVideo && <img src={url} alt={doc.originalFilename} className="max-h-full max-w-full rounded-lg object-contain" />}
        {documents.length > 1 && (
          <button
            type="button"
            onClick={() => onNavigate(1)}
            aria-label="Next"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 sm:right-6"
          >
            <ChevronRight size={22} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>,
    document.body
  );
}

function MediaThumbnail({ doc, canDelete, onDeleted, onOpen }) {
  const { url, error } = useSignedUrl(doc);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const isVideo = doc.mimeType?.startsWith('video/');

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative block aspect-square w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100 text-left dark:border-slate-800 dark:bg-slate-800"
    >
      {!url && !error && (
        <div className="flex h-full items-center justify-center">
          <Spinner size={18} />
        </div>
      )}
      {error && (
        <div className="flex h-full flex-col items-center justify-center gap-1 p-2 text-center">
          <AlertTriangle size={16} className="text-slate-400" aria-hidden="true" />
          <p className="text-xs text-slate-500 dark:text-slate-400">Preview unavailable</p>
        </div>
      )}
      {url && isVideo && (
        <>
          <video src={url} className="h-full w-full object-cover" preload="metadata" />
          <span className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors group-hover:bg-black/30">
            <Film size={22} className="text-white drop-shadow" aria-hidden="true" />
          </span>
        </>
      )}
      {url && !isVideo && (
        <img src={url} alt={doc.originalFilename} className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105" />
      )}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5 opacity-0 transition-opacity group-hover:opacity-100">
        <span className="flex items-center gap-1 truncate text-xs text-white">
          {isVideo ? <Film size={12} aria-hidden="true" /> : <ImageIcon size={12} aria-hidden="true" />}
          <span className="truncate">{doc.originalFilename}</span>
        </span>
        {canDelete && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); setDeleteOpen(true); }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); setDeleteOpen(true); } }}
            aria-label={`Delete ${doc.originalFilename}`}
            className="shrink-0 rounded p-1 text-white hover:bg-white/20"
          >
            <Trash2 size={13} aria-hidden="true" />
          </span>
        )}
      </div>
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={async () => { await documentsApi.remove(doc.id); onDeleted(doc.id); }}
        title="Delete file?"
        description={`This permanently deletes "${doc.originalFilename}".`}
        confirmLabel="Delete"
      />
    </button>
  );
}

// Reusable image/video gallery for any entity the backend's document
// resolver supports (property, building, unit, tenant, owner, ...).
// Cloudinary assets are stored as `authenticated` (private delivery), so
// every thumbnail fetches its own short-lived signed URL rather than using
// a public asset URL. The first item is shown as a large hero with the rest
// as a thumbnail strip; clicking any of them opens a full-screen lightbox.
// `onChange` (optional) fires after any upload or delete — the gallery
// always keeps its own document list in sync on its own, but a parent
// page/card showing a separate server-computed `coverImageUrl` snapshot
// (e.g. PropertyCard, BuildingCard, UnitCard) needs this signal to know its
// own stale copy should be refetched too.
export function MediaGallery({ entityType, entityId, canUpload, canDelete, onChange }) {
  const [documents, setDocuments] = useState(null);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const fileInputRef = useRef(null);

  const load = useCallback(() => {
    documentsApi.list(entityType, entityId, { pageSize: 100 })
      .then((res) => setDocuments(res.data))
      .catch((err) => setError(err.message));
  }, [entityType, entityId]);

  useEffect(() => { load(); }, [load]);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      await documentsApi.upload(entityType, entityId, file);
      load();
      onChange?.();
    } catch (err) {
      setUploadError(err.details?.map((d) => d.message).join(' ') || err.message);
    } finally {
      setUploading(false);
    }
  };

  const removeDoc = (id) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    setLightboxIndex(null);
    onChange?.();
  };

  const navigate = (delta) => {
    setLightboxIndex((i) => {
      const len = documents.length;
      return ((i + delta) % len + len) % len;
    });
  };

  const hero = documents?.[0];
  const rest = documents?.slice(1) ?? [];

  return (
    <div className="flex flex-col gap-3">
      {error && <Alert variant="error">{error}</Alert>}
      {uploadError && <Alert variant="error">{uploadError}</Alert>}

      {documents === null ? (
        <div className="py-6"><Spinner label="Loading media…" /></div>
      ) : documents.length === 0 && !canUpload ? (
        <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">No photos or videos yet.</p>
      ) : documents.length === 0 ? null : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="col-span-2 row-span-2 aspect-square sm:aspect-auto">
            <MediaThumbnail doc={hero} canDelete={canDelete} onDeleted={removeDoc} onOpen={() => setLightboxIndex(0)} />
          </div>
          {rest.slice(0, 6).map((doc, i) => (
            <div key={doc.id} className="relative">
              <MediaThumbnail doc={doc} canDelete={canDelete} onDeleted={removeDoc} onOpen={() => setLightboxIndex(i + 1)} />
              {i === 5 && rest.length > 6 && (
                <div
                  className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg bg-black/50 text-lg font-semibold text-white"
                >
                  +{rest.length - 6}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {canUpload && (
        <div>
          <input ref={fileInputRef} type="file" accept={ACCEPT} className="hidden" onChange={handleFileChange} />
          <Button type="button" variant="secondary" size="sm" loading={uploading} onClick={() => fileInputRef.current?.click()}>
            <Upload size={14} aria-hidden="true" />
            {uploading ? 'Uploading…' : 'Add photo or video'}
          </Button>
          <p className="mt-1 text-xs text-slate-400">JPG, PNG, WEBP up to 10MB · MP4, MOV up to 100MB</p>
        </div>
      )}

      {lightboxIndex !== null && documents?.[lightboxIndex] && (
        <Lightbox documents={documents} index={lightboxIndex} onClose={() => setLightboxIndex(null)} onNavigate={navigate} />
      )}
    </div>
  );
}
