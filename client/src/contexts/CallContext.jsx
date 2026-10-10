import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useChat } from './ChatContext.jsx';
import { chatApi } from '../chat/chatApi.js';

const CallContext = createContext(null);

// Voice and video calls inside a conversation, for up to 8 people at once.
// Audio and video travel directly between browsers (WebRTC, always encrypted
// with DTLS-SRTP); the server only relays the connection set-up messages, and
// only between members of the same conversation. Each person connects to every
// other person ("mesh"), and whoever joins later makes the offers.
export function CallProvider({ children }) {
  const { socket, subscribe, ref: myRef } = useChat();
  const [incoming, setIncoming] = useState(null); // { callId, roomId, video, from, fromName }
  const [active, setActive] = useState(null); // { callId, roomId, video, names }
  const [remotes, setRemotes] = useState({}); // ref -> MediaStream
  const [local, setLocal] = useState(null);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [error, setError] = useState(null);

  const pcs = useRef(new Map());
  const localStream = useRef(null);
  const callRef = useRef(null);
  const iceServers = useRef(null);
  const pendingCandidates = useRef(new Map());

  const cleanup = useCallback(() => {
    for (const pc of pcs.current.values()) pc.close();
    pcs.current.clear();
    pendingCandidates.current.clear();
    localStream.current?.getTracks().forEach((t) => t.stop());
    localStream.current = null;
    callRef.current = null;
    setLocal(null);
    setRemotes({});
    setActive(null);
    setMuted(false);
    setCameraOff(false);
  }, []);

  const send = useCallback((to, data) => {
    socket?.emit('call:signal', { callId: callRef.current?.callId, to, data });
  }, [socket]);

  const getPeer = useCallback(async (peerRef) => {
    let pc = pcs.current.get(peerRef);
    if (pc) return pc;
    if (!iceServers.current) {
      try {
        iceServers.current = (await chatApi.iceServers()).data.iceServers;
      } catch {
        iceServers.current = [{ urls: 'stun:stun.l.google.com:19302' }];
      }
    }
    pc = new RTCPeerConnection({ iceServers: iceServers.current });
    pcs.current.set(peerRef, pc);
    localStream.current?.getTracks().forEach((t) => pc.addTrack(t, localStream.current));
    pc.onicecandidate = (e) => { if (e.candidate) send(peerRef, { type: 'candidate', candidate: e.candidate.toJSON() }); };
    pc.ontrack = (e) => {
      const stream = e.streams[0] ?? new MediaStream([e.track]);
      setRemotes((prev) => ({ ...prev, [peerRef]: stream }));
    };
    pc.onconnectionstatechange = () => {
      if (['failed', 'closed'].includes(pc.connectionState)) {
        pcs.current.delete(peerRef);
        setRemotes((prev) => { const next = { ...prev }; delete next[peerRef]; return next; });
      }
    };
    return pc;
  }, [send]);

  const offerTo = useCallback(async (peerRef) => {
    const pc = await getPeer(peerRef);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    send(peerRef, { type: 'offer', sdp: offer.sdp });
  }, [getPeer, send]);

  const flushCandidates = useCallback(async (peerRef, pc) => {
    for (const c of pendingCandidates.current.get(peerRef) ?? []) await pc.addIceCandidate(c).catch(() => {});
    pendingCandidates.current.delete(peerRef);
  }, []);

  // ── incoming signalling ──
  useEffect(() => subscribe(async (event, payload) => {
    if (event === 'call:incoming') {
      if (!callRef.current) setIncoming(payload);
    } else if (event === 'call:ended') {
      setIncoming((cur) => (cur?.callId === payload.callId ? null : cur));
      if (callRef.current?.callId === payload.callId) cleanup();
    } else if (event === 'call:peer-left') {
      if (callRef.current?.callId !== payload.callId) return;
      pcs.current.get(payload.ref)?.close();
      pcs.current.delete(payload.ref);
      setRemotes((prev) => { const next = { ...prev }; delete next[payload.ref]; return next; });
    } else if (event === 'call:signal') {
      if (callRef.current?.callId !== payload.callId) return;
      const { from, data } = payload;
      try {
        if (data.type === 'offer') {
          const pc = await getPeer(from);
          await pc.setRemoteDescription({ type: 'offer', sdp: data.sdp });
          await flushCandidates(from, pc);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          send(from, { type: 'answer', sdp: answer.sdp });
        } else if (data.type === 'answer') {
          const pc = pcs.current.get(from);
          if (pc) { await pc.setRemoteDescription({ type: 'answer', sdp: data.sdp }); await flushCandidates(from, pc); }
        } else if (data.type === 'candidate') {
          const pc = pcs.current.get(from);
          if (pc?.remoteDescription) await pc.addIceCandidate(data.candidate).catch(() => {});
          else pendingCandidates.current.set(from, [...(pendingCandidates.current.get(from) ?? []), data.candidate]);
        }
      } catch {
        // a bad or stale signal must never break the call for everyone
      }
    }
  }), [subscribe, cleanup, getPeer, send, flushCandidates]);

  useEffect(() => () => cleanup(), [cleanup]);

  const enter = useCallback(async ({ ack, roomId, video }) => {
    let names = {};
    try {
      const room = (await chatApi.room(roomId)).data;
      names = Object.fromEntries(room.members.map((m) => [m.ref, m.name]));
    } catch {
      // names are cosmetic
    }
    callRef.current = { callId: ack.callId, roomId };
    setActive({ callId: ack.callId, roomId, video: ack.video ?? video, names });
    for (const peerRef of ack.peers) await offerTo(peerRef);
  }, [offerTo]);

  const media = useCallback(async (video) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: video ? { width: { ideal: 640 }, height: { ideal: 480 } } : false });
      localStream.current = stream;
      setLocal(stream);
      return true;
    } catch {
      setError(video ? 'Allow camera and microphone access to make a video call.' : 'Allow microphone access to make a voice call.');
      return false;
    }
  }, []);

  const startCall = useCallback(async (roomId, video) => {
    if (callRef.current || !socket) return;
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === 'undefined') { setError('Calls are not supported in this browser.'); return; }
    if (!(await media(video))) return;
    socket.emit('call:start', { roomId, video }, async (ack) => {
      if (!ack?.ok) { setError(ack?.error ?? 'Could not start the call.'); cleanup(); return; }
      await enter({ ack, roomId, video });
    });
  }, [socket, media, enter, cleanup]);

  const acceptCall = useCallback(async () => {
    const call = incoming;
    if (!call || callRef.current || !socket) return;
    setIncoming(null);
    setError(null);
    if (!(await media(call.video))) return;
    socket.emit('call:join', { callId: call.callId }, async (ack) => {
      if (!ack?.ok) { setError(ack?.error ?? 'Could not join the call.'); cleanup(); return; }
      await enter({ ack, roomId: call.roomId, video: call.video });
    });
  }, [incoming, socket, media, enter, cleanup]);

  const declineCall = useCallback(() => {
    if (incoming) socket?.emit('call:decline', { callId: incoming.callId });
    setIncoming(null);
  }, [incoming, socket]);

  const hangUp = useCallback(() => {
    if (callRef.current) socket?.emit('call:leave', { callId: callRef.current.callId });
    cleanup();
  }, [socket, cleanup]);

  const toggleMute = useCallback(() => {
    const next = !muted;
    localStream.current?.getAudioTracks().forEach((t) => { t.enabled = !next; });
    setMuted(next);
  }, [muted]);

  const toggleCamera = useCallback(() => {
    const next = !cameraOff;
    localStream.current?.getVideoTracks().forEach((t) => { t.enabled = !next; });
    setCameraOff(next);
  }, [cameraOff]);

  const value = useMemo(() => ({
    myRef, incoming, active, remotes, local, muted, cameraOff, error,
    startCall, acceptCall, declineCall, hangUp, toggleMute, toggleCamera, dismissError: () => setError(null),
  }), [myRef, incoming, active, remotes, local, muted, cameraOff, error, startCall, acceptCall, declineCall, hangUp, toggleMute, toggleCamera]);

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCall must be used within a CallProvider');
  return ctx;
}

export function useOptionalCall() {
  return useContext(CallContext);
}
