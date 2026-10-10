import { useRef } from 'react';
import { Image as ImageIcon, Film, Upload, X } from 'lucide-react';
import { Button } from '../ui/Button.jsx';

const ACCEPT = '.jpg,.jpeg,.png,.webp,.mp4,.mov';

// Lets a create-form queue photos/videos before the parent entity exists
// yet (a property, tenant, etc. only gets an id once the form submits).
// The parent form owns the `files` state and uploads each one via
// documentsApi.upload(entityType, newId, file) right after creation
// succeeds — this component is purely the picker + preview list.
export function PendingMediaPicker({ files, onChange, label = 'Photos or videos (optional)' }) {
  const inputRef = useRef(null);

  const addFiles = (fileList) => {
    const next = Array.from(fileList);
    if (next.length === 0) return;
    onChange([...files, ...next]);
  };

  const removeAt = (index) => {
    onChange(files.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</p>

      {files.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {files.map((file, i) => (
            <li
              key={`${file.name}-${i}`}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              {file.type.startsWith('video/') ? <Film size={13} aria-hidden="true" /> : <ImageIcon size={13} aria-hidden="true" />}
              <span className="max-w-[160px] truncate">{file.name}</span>
              <button
                type="button"
                onClick={() => removeAt(i)}
                aria-label={`Remove ${file.name}`}
                className="text-slate-400 hover:text-rose-500"
              >
                <X size={13} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
        />
        <Button type="button" variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>
          <Upload size={14} aria-hidden="true" />
          Add photo or video
        </Button>
        <p className="mt-1 text-xs text-slate-400">JPG, PNG, WEBP up to 10MB · MP4, MOV up to 100MB</p>
      </div>
    </div>
  );
}
