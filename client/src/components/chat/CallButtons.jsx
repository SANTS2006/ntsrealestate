import { Phone, Video } from 'lucide-react';
import { useOptionalCall } from '../../contexts/CallContext.jsx';

// Voice and video call buttons in a conversation header. Anyone in the
// conversation who is online gets a ringing prompt and can join.
export function CallButtons({ roomId, disabled }) {
  const call = useOptionalCall();
  if (!call) return null;
  const busy = Boolean(call.active) || disabled;
  const cls = 'rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-800';
  return (
    <>
      <button type="button" onClick={() => call.startCall(roomId, false)} disabled={busy} aria-label="Start a voice call" className={cls}><Phone size={18} aria-hidden="true" /></button>
      <button type="button" onClick={() => call.startCall(roomId, true)} disabled={busy} aria-label="Start a video call" className={cls}><Video size={18} aria-hidden="true" /></button>
    </>
  );
}
