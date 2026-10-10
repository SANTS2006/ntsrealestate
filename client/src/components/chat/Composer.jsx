import { useEffect, useRef, useState } from 'react';
import { Send, Paperclip, Mic, X, Check } from 'lucide-react';
import { Alert } from '../ui/Alert.jsx';
import { validateFile, uploadEncrypted, formatDuration } from '../../chat/media.js';

const RECORDER_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
const MAX_VOICE_SECONDS = 5 * 60;

// The message box: text, pictures/videos (paperclip) and voice messages
// (microphone). Everything is encrypted in this browser before it is sent.
// `sendPayload(payload, attachmentId?)` encrypts the message itself and sends.
export function Composer({ roomId, disabled, sendPayload }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const fileInput = useRef(null);
  const recorder = useRef(null);
  const chunks = useRef([]);
  const stream = useRef(null);
  const timer = useRef(null);
  const discard = useRef(false);
  const secondsRef = useRef(0);

  const stopTracks = () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    clearInterval(timer.current);
  };

  useEffect(() => () => { discard.current = true; recorder.current?.state === 'recording' && recorder.current.stop(); stopTracks(); }, []);

  const guarded = async (fn) => {
    setSending(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err.message || 'Could not send.');
    } finally {
      setSending(false);
    }
  };

  const submitText = (e) => {
    e?.preventDefault();
    const body = text.trim();
    if (!body || sending || disabled) return;
    guarded(async () => {
      await sendPayload({ t: 'text', body });
      setText('');
    });
  };

  const onFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const check = validateFile(file);
    if (check.error) { setError(check.error); return; }
    guarded(async () => {
      const { attachmentId, payload } = await uploadEncrypted(roomId, file, { kind: check.kind, name: file.name, mime: file.type });
      await sendPayload(payload, attachmentId);
    });
  };

  const startRecording = async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Voice messages are not supported in this browser.');
      return;
    }
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError('Allow microphone access to record a voice message.');
      return;
    }
    const mimeType = RECORDER_TYPES.find((t) => MediaRecorder.isTypeSupported(t));
    chunks.current = [];
    discard.current = false;
    const rec = new MediaRecorder(stream.current, mimeType ? { mimeType } : undefined);
    recorder.current = rec;
    rec.ondataavailable = (ev) => { if (ev.data.size > 0) chunks.current.push(ev.data); };
    rec.onstop = () => {
      const duration = secondsRef.current;
      const type = rec.mimeType || mimeType || 'audio/webm';
      const blob = new Blob(chunks.current, { type });
      stopTracks();
      setRecording(false);
      if (discard.current || blob.size === 0) return;
      guarded(async () => {
        const { attachmentId, payload } = await uploadEncrypted(roomId, blob, { kind: 'voice', name: 'Voice message', mime: type, duration });
        await sendPayload(payload, attachmentId);
      });
    };
    rec.start();
    secondsRef.current = 0;
    setSeconds(0);
    setRecording(true);
    timer.current = setInterval(() => {
      secondsRef.current += 1;
      setSeconds(secondsRef.current);
      if (secondsRef.current >= MAX_VOICE_SECONDS && rec.state === 'recording') rec.stop();
    }, 1000);
  };

  const finishRecording = (send) => {
    discard.current = !send;
    if (recorder.current?.state === 'recording') recorder.current.stop();
  };

  if (recording) {
    return (
      <div className="flex items-center gap-3 border-t border-slate-200 p-3 dark:border-slate-800">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-rose-500" aria-hidden="true" />
        <span className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-200" role="status">Recording… {formatDuration(seconds)}</span>
        <button type="button" onClick={() => finishRecording(false)} aria-label="Cancel recording" className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"><X size={17} aria-hidden="true" /></button>
        <button type="button" onClick={() => finishRecording(true)} aria-label="Send voice message" className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white hover:bg-brand-700"><Check size={17} aria-hidden="true" /></button>
      </div>
    );
  }

  return (
    <div className="border-t border-slate-200 p-3 dark:border-slate-800">
      {error && <Alert variant="error" className="mb-2">{error}</Alert>}
      <form onSubmit={submitText} className="flex items-end gap-2">
        <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" className="sr-only" tabIndex={-1} onChange={onFile} />
        <button type="button" onClick={() => fileInput.current?.click()} disabled={disabled || sending} aria-label="Attach a picture or video" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800"><Paperclip size={18} aria-hidden="true" /></button>
        <textarea
          value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) submitText(e); }}
          rows={1} maxLength={4000} disabled={disabled}
          placeholder={disabled ? 'Waiting for the conversation to be unlocked…' : sending ? 'Sending…' : 'Write a message'} aria-label="Message"
          className="max-h-32 min-h-[2.5rem] flex-1 resize-none rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
        {text.trim() ? (
          <button type="submit" disabled={disabled || sending} aria-label="Send" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white transition-colors hover:bg-brand-700 disabled:opacity-50"><Send size={17} aria-hidden="true" /></button>
        ) : (
          <button type="button" onClick={startRecording} disabled={disabled || sending} aria-label="Record a voice message" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white transition-colors hover:bg-brand-700 disabled:opacity-50"><Mic size={17} aria-hidden="true" /></button>
        )}
      </form>
    </div>
  );
}
