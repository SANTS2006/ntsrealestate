import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { API_URL } from '../config/env.js';
import { chatApi } from '../chat/chatApi.js';
import * as C from '../chat/crypto.js';
import { saveIdentity, loadIdentity, clearIdentity } from '../chat/keyStore.js';

const ChatContext = createContext(null);

function socketOrigin() {
  try {
    return new URL(API_URL, window.location.origin).origin;
  } catch {
    return window.location.origin;
  }
}

// Everything chat-related for one signed-in person (an organization user or a
// platform admin): the end-to-end encryption identity (set up once with a chat
// passphrase, unlocked once per device), the list of conversations, the live
// socket, and the helpers that encrypt/decrypt in this browser. The server
// only ever sees ciphertext and public/wrapped keys.
export function ChatProvider({ actor, children }) {
  const ref = `${actor.kind === 'platform' ? 'p' : 'u'}:${actor.id}`;
  const [keyState, setKeyState] = useState('loading'); // loading | setup | locked | ready | error
  const [rooms, setRooms] = useState([]);
  const [socket, setSocket] = useState(null);
  const identity = useRef(null); // { privateKey, publicKey }
  const bundle = useRef(null);
  const roomKeys = useRef(new Map());
  const listeners = useRef(new Set());

  const emit = useCallback((event, payload) => {
    for (const fn of listeners.current) fn(event, payload);
  }, []);

  const subscribe = useCallback((fn) => {
    listeners.current.add(fn);
    return () => listeners.current.delete(fn);
  }, []);

  // ── identity ──────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await chatApi.getKeys();
        if (cancelled) return;
        bundle.current = res.data;
        if (!res.data) { setKeyState('setup'); return; }
        const stored = await loadIdentity(ref);
        if (cancelled) return;
        if (stored && stored.publicKey === res.data.publicKey) {
          identity.current = stored;
          setKeyState('ready');
        } else {
          setKeyState('locked');
        }
      } catch {
        if (!cancelled) setKeyState('error');
      }
    })();
    return () => { cancelled = true; };
  }, [ref]);

  const adopt = useCallback(async (prot, publicKey, passphrase) => {
    // Use the restored (non-extractable) key from here on, and remember it on this device.
    const privateKey = await C.restorePrivateKey(prot, passphrase);
    identity.current = { privateKey, publicKey };
    await saveIdentity(ref, identity.current);
    roomKeys.current.clear();
    setKeyState('ready');
  }, [ref]);

  const createIdentity = useCallback(async (passphrase, reset) => {
    const pair = await C.generateIdentity();
    const publicKey = await C.exportPublicKey(pair.publicKey);
    const prot = await C.protectPrivateKey(pair.privateKey, passphrase);
    await chatApi.saveKeys({ publicKey, ...prot, ...(reset ? { reset: true } : {}) });
    bundle.current = { publicKey, ...prot };
    await adopt(prot, publicKey, passphrase);
  }, [adopt]);

  const setupChat = useCallback((passphrase) => createIdentity(passphrase, false), [createIdentity]);
  const resetChat = useCallback((passphrase) => createIdentity(passphrase, true), [createIdentity]);

  const unlockChat = useCallback(async (passphrase) => {
    try {
      await adopt(bundle.current, bundle.current.publicKey, passphrase);
    } catch {
      throw new Error('That passphrase is not right.');
    }
  }, [adopt]);

  // Forget the unlocked key on this device (called on sign out).
  const lockChat = useCallback(async () => {
    identity.current = null;
    roomKeys.current.clear();
    await clearIdentity(ref);
  }, [ref]);

  // ── rooms ─────────────────────────────────────────────────────────────

  const refreshRooms = useCallback(async () => {
    try {
      const res = await chatApi.rooms();
      setRooms(res.data);
    } catch {
      // keep what we have
    }
  }, []);

  // ── live socket ───────────────────────────────────────────────────────

  useEffect(() => {
    const s = io(socketOrigin(), { withCredentials: true, transports: ['websocket', 'polling'] });
    s.on('chat:message', (message) => { emit('message', message); refreshRooms(); });
    s.on('chat:room', () => refreshRooms());
    s.on('chat:key', (payload) => { emit('key', payload); });
    s.on('chat:typing', (payload) => emit('typing', payload));
    for (const name of ['call:incoming', 'call:peer-joined', 'call:peer-left', 'call:signal', 'call:ended', 'call:declined']) {
      s.on(name, (payload) => emit(name, payload));
    }
    setSocket(s);
    return () => { s.disconnect(); setSocket(null); };
  }, [emit, refreshRooms]);

  useEffect(() => {
    if (keyState === 'ready') refreshRooms();
  }, [keyState, refreshRooms]);

  // ── room keys ─────────────────────────────────────────────────────────

  // Returns { key, room } — `key` is null when nobody who holds the room key
  // has shared it with this person yet. A member who holds the key also hands
  // it to anyone who has since joined (wrapped for their public key).
  const getRoomKey = useCallback(async (roomId) => {
    const me = identity.current;
    if (!me) throw new Error('Chat is locked.');
    const room = (await chatApi.room(roomId)).data;
    let key = roomKeys.current.get(roomId) ?? null;

    if (!key && room.myKey) {
      key = await C.unwrapRoomKey(room.myKey, me.privateKey);
    } else if (!key && !room.members.some((m) => m.hasRoomKey)) {
      const fresh = await C.generateRoomKey();
      const entries = [];
      for (const m of room.members.filter((x) => x.publicKey)) {
        entries.push({ ref: m.ref, ...(await C.wrapRoomKey(fresh, me.privateKey, me.publicKey, m.publicKey)) });
      }
      try {
        await chatApi.distributeKeys(roomId, entries);
        key = await C.unwrapRoomKey(entries.find((e) => e.ref === ref), me.privateKey);
      } catch {
        // Someone else initialized it first — fetch theirs.
        const again = (await chatApi.room(roomId)).data;
        if (again.myKey) key = await C.unwrapRoomKey(again.myKey, me.privateKey);
      }
    }

    if (key) {
      roomKeys.current.set(roomId, key);
      const missing = room.members.filter((m) => m.publicKey && !m.hasRoomKey && m.ref !== ref);
      if (missing.length > 0 && room.myKey) {
        try {
          const entries = [];
          for (const m of missing) entries.push({ ref: m.ref, ...(await C.wrapRoomKey(key, me.privateKey, me.publicKey, m.publicKey)) });
          await chatApi.distributeKeys(roomId, entries);
        } catch {
          // best effort; another member will do it
        }
      }
    }
    return { key, room };
  }, [ref]);

  const encryptFor = useCallback(async (roomId, payload) => {
    const { key } = await getRoomKey(roomId);
    if (!key) throw new Error('This conversation is not unlocked for you yet. Ask someone in it to open it, then try again.');
    return C.encryptPayload(key, payload, roomId, ref);
  }, [getRoomKey, ref]);

  const decryptMessage = useCallback(async (message) => {
    let key = roomKeys.current.get(message.roomId);
    if (!key) ({ key } = await getRoomKey(message.roomId));
    if (!key) throw new Error('locked');
    return C.decryptPayload(key, message, message.roomId, message.sender);
  }, [getRoomKey]);

  const totalUnread = useMemo(() => rooms.reduce((n, r) => n + (r.unread ?? 0), 0), [rooms]);

  const value = useMemo(() => ({
    ref, actor, keyState, rooms, socket, totalUnread,
    setupChat, unlockChat, resetChat, lockChat,
    refreshRooms, subscribe, getRoomKey, encryptFor, decryptMessage,
    getIdentity: () => identity.current,
  }), [ref, actor, keyState, rooms, socket, totalUnread, setupChat, unlockChat, resetChat, lockChat, refreshRooms, subscribe, getRoomKey, encryptFor, decryptMessage]);

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within a ChatProvider');
  return ctx;
}

// Same hook, but safe where a provider may not be mounted (e.g. unread badge
// in a layout shared with unauthenticated screens).
export function useOptionalChat() {
  return useContext(ChatContext);
}
