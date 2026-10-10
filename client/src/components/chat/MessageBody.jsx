import { useEffect, useState } from 'react';
import { Download, FileWarning } from 'lucide-react';
import { openAttachment, kindOf, formatDuration } from '../../chat/media.js';

// Decrypts a message's attachment in the browser and gives back an object
// URL. A message claiming a type we don't play (e.g. HTML) is never opened:
// the declared type must match what the sender's payload says AND be on the
// media allowlist.
function useMedia(message) {
  const { attachmentId, payload } = message;
  const [url, setUrl] = useState(null);
  const [error, setError] = useState(false);
  const allowed = Boolean(attachmentId) && kindOf(payload?.mime) === (payload?.t === 'voice' ? 'voice' : payload?.t);

  useEffect(() => {
    if (!allowed) return undefined;
    let cancelled = false;
    openAttachment(attachmentId, payload).then((u) => { if (!cancelled) setUrl(u); }).catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [allowed, attachmentId, payload]);

  return { url, error: error || !allowed };
}

function Placeholder({ label }) {
  return <div className="flex h-32 w-56 animate-pulse items-center justify-center rounded-lg bg-black/10 text-xs opacity-70">{label}</div>;
}

function MediaFailed() {
  return <p className="flex items-center gap-1.5 italic opacity-70"><FileWarning size={14} aria-hidden="true" />This file could not be opened.</p>;
}

function ImageMessage({ message }) {
  const { url, error } = useMedia(message);
  if (error) return <MediaFailed />;
  if (!url) return <Placeholder label="Decrypting picture…" />;
  return (
    <a href={url} target="_blank" rel="noreferrer" aria-label="Open picture">
      <img src={url} alt={message.payload.name || 'Picture'} className="max-h-72 max-w-full rounded-lg object-cover" />
    </a>
  );
}

function VideoMessage({ message }) {
  const { url, error } = useMedia(message);
  if (error) return <MediaFailed />;
  if (!url) return <Placeholder label="Decrypting video…" />;
  return <video src={url} controls preload="metadata" className="max-h-72 max-w-full rounded-lg bg-black" />;
}

function VoiceMessage({ message }) {
  const { url, error } = useMedia(message);
  if (error) return <MediaFailed />;
  return (
    <div className="flex min-w-[14rem] flex-col gap-1">
      {url ? <audio src={url} controls preload="metadata" className="h-9 w-full" /> : <div className="h-9 w-56 animate-pulse rounded-full bg-black/10" />}
      {message.payload.duration ? <span className="text-[11px] opacity-70">Voice message · {formatDuration(message.payload.duration)}</span> : null}
    </div>
  );
}

// Renders one decrypted message payload. Text is shown as plain text (never
// as HTML), so a message can never inject markup into anyone's page.
export function MessageBody({ message }) {
  const { payload } = message;
  switch (payload?.t) {
    case 'text':
      return <p className="whitespace-pre-wrap break-words">{payload.body}</p>;
    case 'image':
      return <ImageMessage message={message} />;
    case 'video':
      return <VideoMessage message={message} />;
    case 'voice':
      return <VoiceMessage message={message} />;
    default:
      return <p className="flex items-center gap-1.5 italic opacity-70"><Download size={14} aria-hidden="true" />Unsupported message.</p>;
  }
}
