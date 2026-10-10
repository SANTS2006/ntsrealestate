import { randomUUID } from 'node:crypto';
import { Server } from 'socket.io';
import { env, corsOrigins } from '../config/env.js';
import { logger } from '../config/logger.js';
import { sessionMiddleware } from '../config/session.js';
import { prisma } from '../config/database.js';
import { setIo } from './hub.js';
import { assertRoomMember, actorRef, displayNameFor } from '../services/chat.service.js';

const MAX_CALL_PARTICIPANTS = 8;

// Active calls, by call id. In memory on purpose: a call is a live thing, and
// a single server instance handles all of them (see render.yaml). { id,
// roomId, video, startedBy, participants: Map(ref -> socketId) }
const calls = new Map();
const callByRoom = new Map();

async function actorFromSession(session) {
  if (session?.platformAdminId) {
    const admin = await prisma.platformAdmin.findUnique({ where: { id: session.platformAdminId } });
    if (!admin || !admin.isActive) return null;
    return { kind: 'platform', id: admin.id };
  }
  if (session?.userId) {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      include: { organization: { select: { status: true } }, userRoles: { include: { role: true } } },
    });
    if (!user || user.status !== 'active' || user.organizationId !== session.organizationId || user.organization.status !== 'active') return null;
    return { kind: 'user', id: user.id, organizationId: user.organizationId, roles: user.userRoles.map((ur) => ur.role.name) };
  }
  return null;
}

function endCallIfEmpty(io, call) {
  if (call.participants.size > 0) return;
  calls.delete(call.id);
  if (callByRoom.get(call.roomId) === call.id) callByRoom.delete(call.roomId);
  io.to(`room:${call.roomId}`).emit('call:ended', { callId: call.id, roomId: call.roomId });
}

function leaveCall(io, socket, call) {
  const ref = actorRef(socket.data.actor);
  if (call.participants.get(ref) !== socket.id) return;
  call.participants.delete(ref);
  socket.leave(`call:${call.id}`);
  io.to(`call:${call.id}`).emit('call:peer-left', { callId: call.id, ref });
  endCallIfEmpty(io, call);
}

export function initRealtime(httpServer) {
  const allowedOrigins = new Set([...corsOrigins, env.CLIENT_URL].filter(Boolean));

  const io = new Server(httpServer, {
    cors: { origin: [...allowedOrigins], credentials: true },
    maxHttpBufferSize: 1_000_000,
    // Browsers do not apply CORS to WebSockets, so a hostile web page could
    // otherwise open a socket carrying the visitor's session cookie. Only
    // our own origins (or non-browser clients, which send no Origin) get in.
    allowRequest: (req, callback) => {
      const origin = req.headers.origin;
      callback(null, !origin || allowedOrigins.has(origin));
    },
  });
  setIo(io);

  // Reuse the very same express-session cookie/store as the REST API.
  io.engine.use(sessionMiddleware);

  io.use(async (socket, next) => {
    try {
      const actor = await actorFromSession(socket.request.session);
      if (!actor) return next(new Error('unauthorized'));
      socket.data.actor = actor;
      return next();
    } catch (err) {
      logger.error({ err }, 'socket auth failed');
      return next(new Error('unauthorized'));
    }
  });

  io.on('connection', async (socket) => {
    const actor = socket.data.actor;
    const ref = actorRef(actor);
    socket.join(`actor:${ref}`);

    const memberships = await prisma.chatMember.findMany({
      where: actor.kind === 'platform' ? { platformAdminId: actor.id } : { userId: actor.id },
      select: { roomId: true },
    });
    for (const m of memberships) socket.join(`room:${m.roomId}`);

    // ── calls (WebRTC signalling only; media flows peer to peer) ──
    socket.on('call:start', async ({ roomId, video } = {}, ack) => {
      try {
        await assertRoomMember(roomId, actor);
        let call = calls.get(callByRoom.get(roomId));
        const isNew = !call;
        if (!call) {
          call = { id: randomUUID(), roomId, video: Boolean(video), startedBy: ref, participants: new Map() };
          calls.set(call.id, call);
          callByRoom.set(roomId, call.id);
        }
        if (call.participants.size >= MAX_CALL_PARTICIPANTS && !call.participants.has(ref)) throw new Error('This call is full.');
        const existing = [...call.participants.keys()].filter((r) => r !== ref);
        call.participants.set(ref, socket.id);
        socket.join(`call:${call.id}`);

        if (isNew) {
          socket.to(`room:${roomId}`).emit('call:incoming', {
            callId: call.id, roomId, video: call.video, from: ref, fromName: await displayNameFor(actor),
          });
        } else {
          socket.to(`call:${call.id}`).emit('call:peer-joined', { callId: call.id, ref });
        }
        ack?.({ ok: true, callId: call.id, video: call.video, peers: existing });
      } catch (err) {
        ack?.({ ok: false, error: err.message || 'Could not start the call.' });
      }
    });

    socket.on('call:join', async ({ callId } = {}, ack) => {
      try {
        const call = calls.get(callId);
        if (!call) throw new Error('This call has ended.');
        await assertRoomMember(call.roomId, actor);
        if (call.participants.size >= MAX_CALL_PARTICIPANTS && !call.participants.has(ref)) throw new Error('This call is full.');
        const existing = [...call.participants.keys()].filter((r) => r !== ref);
        call.participants.set(ref, socket.id);
        socket.join(`call:${call.id}`);
        socket.to(`call:${call.id}`).emit('call:peer-joined', { callId: call.id, ref });
        ack?.({ ok: true, callId: call.id, video: call.video, peers: existing });
      } catch (err) {
        ack?.({ ok: false, error: err.message || 'Could not join the call.' });
      }
    });

    // Relays an SDP offer/answer or ICE candidate to one other participant
    // of the same call — never to anyone outside it.
    socket.on('call:signal', ({ callId, to, data } = {}) => {
      const call = calls.get(callId);
      if (!call || !call.participants.has(ref) || !call.participants.has(to)) return;
      io.to(`actor:${to}`).emit('call:signal', { callId, from: ref, data });
    });

    socket.on('call:leave', ({ callId } = {}) => {
      const call = calls.get(callId);
      if (call) leaveCall(io, socket, call);
    });

    socket.on('call:decline', ({ callId } = {}) => {
      const call = calls.get(callId);
      if (call) io.to(`actor:${call.startedBy}`).emit('call:declined', { callId, ref });
    });

    socket.on('chat:typing', async ({ roomId } = {}) => {
      try {
        await assertRoomMember(roomId, actor);
        socket.to(`room:${roomId}`).emit('chat:typing', { roomId, ref });
      } catch {
        // not a member: ignore
      }
    });

    socket.on('disconnect', () => {
      for (const call of calls.values()) leaveCall(io, socket, call);
    });
  });

  // A deactivated person (or company) must lose the live connection too, not
  // just the ability to make new requests.
  const sweep = setInterval(async () => {
    try {
      const sockets = await io.fetchSockets();
      const checked = new Map();
      for (const s of sockets) {
        const key = actorRef(s.data.actor);
        if (!checked.has(key)) checked.set(key, Boolean(await actorFromSession({ ...(s.data.actor.kind === 'platform' ? { platformAdminId: s.data.actor.id } : { userId: s.data.actor.id, organizationId: s.data.actor.organizationId }) })));
        if (!checked.get(key)) s.disconnect(true);
      }
    } catch (err) {
      logger.error({ err }, 'socket sweep failed');
    }
  }, 60_000);
  sweep.unref();

  return io;
}
