import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Lock, MessageSquarePlus, Search, Send, ShieldCheck, Users, User, LifeBuoy, KeyRound } from 'lucide-react';
import clsx from 'clsx';
import { Button } from '../ui/Button.jsx';
import { Alert } from '../ui/Alert.jsx';
import { Modal } from '../ui/Modal.jsx';
import { Field } from '../ui/Input.jsx';
import { LoadingState } from '../ui/Spinner.jsx';
import { useChat } from '../../contexts/ChatContext.jsx';
import { chatApi } from '../../chat/chatApi.js';
import { fingerprint } from '../../chat/crypto.js';
import { MessageBody } from './MessageBody.jsx';
import { Composer } from './Composer.jsx';
import { CallButtons } from './CallButtons.jsx';

const timeFmt = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });
const dayFmt = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' });

const ROLE_LABEL = { tenant: 'Tenant', owner: 'Owner', agent: 'Agent', administrator: 'Administrator', platform_admin: 'Platform admin', member: 'Member' };

// ── set up / unlock ─────────────────────────────────────────────────────

function SecureChatGate() {
  const { keyState, setupChat, unlockChat, resetChat } = useChat();
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [resetting, setResetting] = useState(false);

  if (keyState === 'loading') return <LoadingState label="Opening secure chat…" />;
  if (keyState === 'error') return <Alert variant="error">Secure chat could not be reached. Please refresh and try again.</Alert>;

  const isSetup = keyState === 'setup' || resetting;

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (isSetup) {
      if (passphrase.length < 8) { setError('Choose a passphrase of at least 8 characters.'); return; }
      if (passphrase !== confirm) { setError('The two passphrases do not match.'); return; }
    }
    setBusy(true);
    try {
      if (resetting) await resetChat(passphrase);
      else if (isSetup) await setupChat(passphrase);
      else await unlockChat(passphrase);
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400"><Lock size={20} aria-hidden="true" /></span>
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{resetting ? 'Reset secure chat' : isSetup ? 'Set up secure chat' : 'Unlock secure chat'}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">End-to-end encrypted — only the people in a conversation can read it.</p>
        </div>
      </div>
      {isSetup ? (
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Choose a chat passphrase. It protects your encryption key and is never sent to the server, so
          <strong> nobody can recover it for you</strong>. You will enter it once on each new device.
          {resetting && ' Resetting makes older messages unreadable for you.'}
        </p>
      ) : (
        <p className="text-sm text-slate-600 dark:text-slate-300">Enter your chat passphrase to read your conversations on this device.</p>
      )}
      {error && <Alert variant="error">{error}</Alert>}
      <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
        <Field label="Chat passphrase" type="password" autoComplete={isSetup ? 'new-password' : 'current-password'} autoFocus value={passphrase} onChange={(e) => setPassphrase(e.target.value)} />
        {isSetup && <Field label="Confirm passphrase" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />}
        <Button type="submit" loading={busy} className="w-full">{resetting ? 'Reset and continue' : isSetup ? 'Turn on secure chat' : 'Unlock'}</Button>
      </form>
      {!isSetup && (
        <button type="button" onClick={() => { setResetting(true); setError(null); }} className="text-sm text-slate-500 underline hover:text-slate-700 dark:text-slate-400">
          Forgot your passphrase?
        </button>
      )}
      {resetting && <button type="button" onClick={() => setResetting(false)} className="text-sm text-slate-500 underline">Cancel</button>}
    </div>
  );
}

// ── room list ───────────────────────────────────────────────────────────

const GROUPS = [
  { id: 'community', label: 'Communities', types: ['community_tenants', 'community_staff', 'community_all'], icon: Users },
  { id: 'direct', label: 'Private chats', types: ['direct'], icon: User },
  { id: 'support', label: 'Support', types: ['support'], icon: LifeBuoy },
];

function RoomList({ rooms, activeId, onSelect, onNewChat, canDirect }) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-slate-200 p-3 dark:border-slate-800">
        <div className="relative flex-1">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" aria-label="Search conversations"
            className="h-9 w-full rounded-lg border border-slate-300 bg-white pl-8 pr-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>
        {canDirect && (
          <Button size="sm" onClick={onNewChat} aria-label="Start a private chat"><MessageSquarePlus size={15} aria-hidden="true" /></Button>
        )}
      </div>
      <div className="custom-scrollbar flex-1 overflow-y-auto p-2">
        {GROUPS.map((g) => {
          const items = rooms.filter((r) => g.types.includes(r.type) && (!q || r.title.toLowerCase().includes(q)));
          if (items.length === 0) return null;
          return (
            <div key={g.id} className="mb-3">
              <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{g.label}</p>
              {items.map((r) => (
                <button
                  key={r.id} type="button" onClick={() => onSelect(r.id)}
                  className={clsx('flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors', r.id === activeId ? 'bg-brand-50 dark:bg-brand-950' : 'hover:bg-slate-100 dark:hover:bg-slate-800')}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-600 to-accent-600 text-xs font-semibold text-white">
                    {g.id === 'direct' ? r.title.split(' ').map((w) => w[0]).slice(0, 2).join('') : <g.icon size={16} aria-hidden="true" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{r.title}</span>
                      {r.unread > 0 && <span className="shrink-0 rounded-full bg-brand-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">{r.unread > 99 ? '99+' : r.unread}</span>}
                    </span>
                    <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                      {r.type === 'direct' ? ROLE_LABEL[r.other?.role] ?? '' : `${r.memberCount} members`}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          );
        })}
        {rooms.length === 0 && <p className="px-3 py-6 text-center text-sm text-slate-500 dark:text-slate-400">No conversations yet.</p>}
      </div>
    </div>
  );
}

// ── start a private chat ────────────────────────────────────────────────

function NewChatModal({ open, onClose, onOpened }) {
  const [people, setPeople] = useState(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    if (!open) return;
    setQuery(''); setError(null);
    chatApi.directory().then((res) => setPeople(res.data)).catch((err) => setError(err.message));
  }, [open]);

  const q = query.trim().toLowerCase();
  const visible = (people ?? []).filter((p) => !q || p.name.toLowerCase().includes(q));

  const start = async (p) => {
    setBusy(p.ref); setError(null);
    try {
      const res = await chatApi.openDirect(p.ref);
      onOpened(res.data.roomId);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Start a private chat" description="Only you and the person you pick can read it." size="md">
      {error && <Alert variant="error" className="mb-3">{error}</Alert>}
      <input
        type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name" aria-label="Search people" autoFocus
        className="mb-3 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      />
      {!people && !error && <LoadingState label="Loading people…" />}
      <ul className="custom-scrollbar max-h-80 overflow-y-auto">
        {visible.map((p) => (
          <li key={p.ref}>
            <button type="button" onClick={() => start(p)} disabled={busy === p.ref} className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800">
              <span className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{p.name}</span>
              <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">{ROLE_LABEL[p.role] ?? p.role}</span>
            </button>
          </li>
        ))}
        {people && visible.length === 0 && <li className="px-2 py-6 text-center text-sm text-slate-500">No one found.</li>}
      </ul>
    </Modal>
  );
}

// ── safety check ────────────────────────────────────────────────────────

function SafetyModal({ open, onClose, members, myRef }) {
  const [prints, setPrints] = useState({});
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const next = {};
      for (const m of members) next[m.ref] = m.publicKey ? await fingerprint(m.publicKey) : null;
      if (!cancelled) setPrints(next);
    })();
    return () => { cancelled = true; };
  }, [open, members]);

  return (
    <Modal open={open} onClose={onClose} title="Encryption" description="Messages here are encrypted on your device and can only be opened by the members below." size="md">
      <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
        To be sure nobody has tampered with a person&apos;s key, compare their fingerprint with what they see on their own screen.
      </p>
      <ul className="custom-scrollbar max-h-72 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
        {members.map((m) => (
          <li key={m.ref} className="py-2">
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{m.name}{m.ref === myRef && ' (you)'} <span className="font-normal text-slate-500">· {ROLE_LABEL[m.role] ?? m.role}</span></p>
            <p className="font-mono text-xs text-slate-500 dark:text-slate-400">{m.publicKey ? (prints[m.ref] ?? '…') : 'Has not set up secure chat yet'}</p>
          </li>
        ))}
      </ul>
    </Modal>
  );
}

// ── one conversation ────────────────────────────────────────────────────

function Conversation({ roomId, title, onBack }) {
  const { ref, subscribe, getRoomKey, decryptMessage, encryptFor, refreshRooms } = useChat();
  const [room, setRoom] = useState(null);
  const [items, setItems] = useState(null); // [{ id, sender, createdAt, payload, failed }]
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState(null);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const bottomRef = useRef(null);

  const nameOf = useMemo(() => {
    const map = new Map((room?.members ?? []).map((m) => [m.ref, m.name]));
    return (r) => map.get(r) ?? 'Someone';
  }, [room]);

  const open = useCallback(async (message) => {
    try {
      return { id: message.id, sender: message.sender, createdAt: message.createdAt, attachmentId: message.attachmentId, payload: await decryptMessage(message) };
    } catch {
      return { id: message.id, sender: message.sender, createdAt: message.createdAt, failed: true };
    }
  }, [decryptMessage]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { key, room: detail } = await getRoomKey(roomId);
      setRoom(detail);
      if (!key) { setLocked(true); setItems([]); return; }
      setLocked(false);
      const res = await chatApi.messages(roomId, { limit: 60 });
      setItems(await Promise.all(res.data.map(open)));
      chatApi.markRead(roomId).then(refreshRooms).catch(() => {});
    } catch (err) {
      setError(err.message || 'Could not open this conversation.');
      setItems([]);
    }
  }, [roomId, getRoomKey, open, refreshRooms]);

  useEffect(() => { setItems(null); setRoom(null); load(); }, [load]);

  useEffect(() => subscribe(async (event, payload) => {
    if (event === 'message' && payload.roomId === roomId) {
      const opened = await open(payload);
      setItems((prev) => (prev && !prev.some((m) => m.id === opened.id) ? [...prev, opened] : prev));
      chatApi.markRead(roomId).then(refreshRooms).catch(() => {});
    }
    if (event === 'key' && payload.roomId === roomId) load();
  }), [subscribe, roomId, open, load, refreshRooms]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ block: 'end' }); }, [items]);

  const sendPayload = async (payload, attachmentId) => {
    const enc = await encryptFor(roomId, payload);
    await chatApi.send(roomId, { ...enc, ...(attachmentId ? { attachmentId } : {}) });
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-3 dark:border-slate-800">
        <button type="button" onClick={onBack} aria-label="Back to conversations" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden dark:hover:bg-slate-800"><ArrowLeft size={18} aria-hidden="true" /></button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</p>
          <p className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400"><Lock size={11} aria-hidden="true" />End-to-end encrypted{room ? ` · ${room.members.length} members` : ''}</p>
        </div>
        <CallButtons roomId={roomId} disabled={locked} />
        <button type="button" onClick={() => setSafetyOpen(true)} aria-label="Encryption details" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><ShieldCheck size={18} aria-hidden="true" /></button>
      </div>

      <div className="custom-scrollbar flex-1 overflow-y-auto bg-slate-50 px-3 py-4 dark:bg-slate-950/40">
        {error && <Alert variant="error" className="mb-3">{error}</Alert>}
        {locked && (
          <Alert variant="warning" className="mb-3">
            <KeyRound size={14} className="mr-1 inline" aria-hidden="true" />
            This conversation isn&apos;t unlocked for you yet. Someone who is already in it needs to open it once to share the key — you&apos;ll get access automatically.
          </Alert>
        )}
        {!items && !error && <LoadingState label="Decrypting…" />}
        {items?.length === 0 && !locked && !error && <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">No messages yet — say hello.</p>}
        <div className="flex flex-col gap-1.5">
          {items?.map((m, i) => {
            const mine = m.sender === ref;
            const prev = items[i - 1];
            const showDay = !prev || dayFmt.format(new Date(prev.createdAt)) !== dayFmt.format(new Date(m.createdAt));
            const showName = !mine && (!prev || prev.sender !== m.sender || showDay);
            return (
              <div key={m.id}>
                {showDay && <p className="my-2 text-center text-xs text-slate-400">{dayFmt.format(new Date(m.createdAt))}</p>}
                <div className={clsx('flex', mine ? 'justify-end' : 'justify-start')}>
                  <div className={clsx('max-w-[82%] rounded-2xl px-3 py-2 text-sm shadow-sm', mine ? 'rounded-br-md bg-brand-600 text-white' : 'rounded-bl-md bg-white text-slate-900 dark:bg-slate-800 dark:text-slate-100')}>
                    {showName && <p className="mb-0.5 text-xs font-semibold text-accent-600 dark:text-accent-400">{nameOf(m.sender)}</p>}
                    {m.failed ? <p className="italic opacity-70">This message could not be decrypted.</p> : <MessageBody message={m} mine={mine} />}
                    <p className={clsx('mt-1 text-right text-[10px]', mine ? 'text-white/70' : 'text-slate-400')}>{timeFmt.format(new Date(m.createdAt))}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div ref={bottomRef} />
      </div>

      <Composer roomId={roomId} disabled={locked} sendPayload={sendPayload} />
      <SafetyModal open={safetyOpen} onClose={() => setSafetyOpen(false)} members={room?.members ?? []} myRef={ref} />
    </div>
  );
}

// ── the whole workspace ─────────────────────────────────────────────────

export function ChatWorkspace() {
  const { keyState, rooms, refreshRooms, actor } = useChat();
  const [activeId, setActiveId] = useState(null);
  const [newChatOpen, setNewChatOpen] = useState(false);

  useEffect(() => {
    if (!activeId && rooms.length > 0 && window.matchMedia('(min-width: 1024px)').matches) setActiveId(rooms[0].id);
  }, [rooms, activeId]);

  if (keyState !== 'ready') return <SecureChatGate />;

  const active = rooms.find((r) => r.id === activeId);
  const canDirect = actor.kind === 'user' && rooms.some((r) => r.type.startsWith('community'));

  return (
    <div
      className={clsx(
        'flex overflow-hidden border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:h-[calc(100vh-11rem)] lg:min-h-[28rem] lg:rounded-2xl',
        // Phones: an open conversation takes over the whole screen (like any
        // messaging app) so the message box is never below the fold; the list
        // sits in the page at a height that fits the screen.
        active ? 'max-lg:fixed max-lg:inset-0 max-lg:z-40 max-lg:rounded-none' : 'h-[calc(100dvh-17rem)] min-h-[20rem] rounded-2xl',
      )}
    >
      <div className={clsx('w-full shrink-0 border-r border-slate-200 lg:w-80 dark:border-slate-800', active ? 'hidden lg:block' : 'block')}>
        <RoomList rooms={rooms} activeId={activeId} onSelect={setActiveId} onNewChat={() => setNewChatOpen(true)} canDirect={canDirect} />
      </div>
      <div className={clsx('min-w-0 flex-1', active ? 'block' : 'hidden lg:block')}>
        {active ? (
          <Conversation key={active.id} roomId={active.id} title={active.title} onBack={() => setActiveId(null)} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-slate-500 dark:text-slate-400">
            <Send size={28} className="text-slate-300 dark:text-slate-700" aria-hidden="true" />
            <p className="text-sm">Choose a conversation.</p>
          </div>
        )}
      </div>
      <NewChatModal open={newChatOpen} onClose={() => setNewChatOpen(false)} onOpened={(id) => { refreshRooms().then(() => setActiveId(id)); }} />
    </div>
  );
}
