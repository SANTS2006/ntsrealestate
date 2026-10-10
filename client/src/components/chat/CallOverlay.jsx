import { useEffect, useRef } from 'react';
import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff } from 'lucide-react';
import { useCall } from '../../contexts/CallContext.jsx';

function Tile({ stream, name, muted = false, mirror = false, video }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.srcObject = stream ?? null; }, [stream]);
  const hasVideo = video && stream?.getVideoTracks().length > 0;
  return (
    <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-xl bg-slate-800">
      {/* A <video> element plays audio for voice calls too; it is simply hidden. */}
      <video ref={ref} autoPlay playsInline muted={muted} className={hasVideo ? `h-full w-full object-cover ${mirror ? '-scale-x-100' : ''}` : 'hidden'} />
      {!hasVideo && (
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-brand-600 to-accent-600 text-xl font-semibold text-white">
          {name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
        </span>
      )}
      <span className="absolute bottom-2 left-2 rounded-md bg-black/60 px-2 py-0.5 text-xs text-white">{name}</span>
    </div>
  );
}

// The ringing prompt and the in-call screen. Mounted once per signed-in
// person, so a call can come in (and carry on) from any page.
export function CallOverlay() {
  const { incoming, active, remotes, local, muted, cameraOff, error, myRef, acceptCall, declineCall, hangUp, toggleMute, toggleCamera, dismissError } = useCall();

  if (active) {
    const peers = Object.entries(remotes);
    return (
      <div role="dialog" aria-modal="true" aria-label="Call in progress" className="fixed inset-0 z-[60] flex flex-col bg-slate-950/95 p-4 text-white">
        <p className="mb-3 text-center text-sm text-white/70">{active.video ? 'Video call' : 'Voice call'} · {peers.length + 1} on the call</p>
        <div className="grid flex-1 auto-rows-fr grid-cols-1 content-center gap-3 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
          <Tile stream={local} name="You" muted mirror video={active.video && !cameraOff} />
          {peers.map(([peerRef, stream]) => <Tile key={peerRef} stream={stream} name={active.names[peerRef] ?? 'Participant'} video={active.video} />)}
        </div>
        {peers.length === 0 && <p className="py-2 text-center text-sm text-white/60">Waiting for others to join…</p>}
        <div className="flex items-center justify-center gap-4 py-4">
          <button type="button" onClick={toggleMute} aria-label={muted ? 'Unmute microphone' : 'Mute microphone'} aria-pressed={muted} className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 hover:bg-white/25">
            {muted ? <MicOff size={20} aria-hidden="true" /> : <Mic size={20} aria-hidden="true" />}
          </button>
          {active.video && (
            <button type="button" onClick={toggleCamera} aria-label={cameraOff ? 'Turn camera on' : 'Turn camera off'} aria-pressed={cameraOff} className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 hover:bg-white/25">
              {cameraOff ? <VideoOff size={20} aria-hidden="true" /> : <Video size={20} aria-hidden="true" />}
            </button>
          )}
          <button type="button" onClick={hangUp} aria-label="Leave call" className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-600 hover:bg-rose-700"><PhoneOff size={20} aria-hidden="true" /></button>
        </div>
        <span className="sr-only">{myRef}</span>
      </div>
    );
  }

  if (incoming) {
    return (
      <div role="alertdialog" aria-label="Incoming call" className="fixed inset-x-0 top-4 z-[60] mx-auto flex w-[min(92vw,24rem)] items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <span className="flex h-11 w-11 shrink-0 animate-pulse items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950"><Phone size={20} aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{incoming.fromName}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Incoming {incoming.video ? 'video' : 'voice'} call</p>
        </div>
        <button type="button" onClick={declineCall} aria-label="Decline call" className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-600 text-white hover:bg-rose-700"><PhoneOff size={18} aria-hidden="true" /></button>
        <button type="button" onClick={acceptCall} aria-label="Accept call" className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-white hover:bg-emerald-700"><Phone size={18} aria-hidden="true" /></button>
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="fixed inset-x-0 top-4 z-[60] mx-auto flex w-[min(92vw,24rem)] items-center gap-3 rounded-xl bg-rose-600 p-3 text-sm text-white shadow-xl">
        <span className="flex-1">{error}</span>
        <button type="button" onClick={dismissError} className="underline">Dismiss</button>
      </div>
    );
  }
  return null;
}
