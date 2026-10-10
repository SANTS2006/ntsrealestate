import { Prisma } from '@prisma/client';
import { prisma } from '../config/database.js';
import { AppError } from '../utils/AppError.js';
import { emitToRoom, joinActorToRoom, leaveActorFromRoom, emitToActor } from '../realtime/hub.js';

// ── who is who ──────────────────────────────────────────────────────────
// An "actor" is whoever is chatting: a signed-in user of an organization, or
// a platform admin. { kind: 'user', id, organizationId, roles } or
// { kind: 'platform', id }. A "ref" is the string form ("u:<id>" / "p:<id>")
// the API and the browsers use to name an actor.

export const refOf = (kind, id) => `${kind === 'platform' ? 'p' : 'u'}:${id}`;
export const actorRef = (actor) => refOf(actor.kind, actor.id);

export function parseRef(ref) {
  const m = /^([up]):([0-9a-f-]{36})$/i.exec(ref ?? '');
  if (!m) throw AppError.badRequest('Invalid participant.');
  return { kind: m[1] === 'p' ? 'platform' : 'user', id: m[2] };
}

const memberKey = (actor) => (actor.kind === 'platform' ? { platformAdminId: actor.id } : { userId: actor.id });
const COMMUNITY_ROLES = ['tenant', 'owner', 'agent'];
const isCommunityUser = (actor) => actor.kind === 'user' && actor.roles.some((r) => COMMUNITY_ROLES.includes(r));
const isOrgAdmin = (actor) => actor.kind === 'user' && actor.roles.includes('administrator');

// Tenants may talk to agents (and other tenants) but never to owners — and
// owners never to tenants. This covers writing, calling and even seeing the
// conversation. A person who is both a tenant and an owner is not restricted.
const tenantOnly = (roles) => roles.includes('tenant') && !roles.includes('owner');
const ownerOnly = (roles) => roles.includes('owner') && !roles.includes('tenant');
const tenantOwnerPair = (a, b) => (tenantOnly(a) && ownerOnly(b)) || (ownerOnly(a) && tenantOnly(b));
const rolesOfUser = (u) => u.userRoles.map((r) => r.role.name);

async function directRoomForbidden(roomId) {
  const members = await prisma.chatMember.findMany({ where: { roomId, userId: { not: null } }, select: { user: { select: { userRoles: { select: { role: { select: { name: true } } } } } } } });
  const roleSets = members.map((m) => rolesOfUser(m.user));
  return roleSets.some((a, i) => roleSets.some((b, j) => i !== j && tenantOwnerPair(a, b)));
}

const roleLabel = (roles) => (roles.includes('administrator') ? 'administrator' : roles.find((r) => COMMUNITY_ROLES.includes(r)) ?? roles[0] ?? 'member');

const ROOM_TITLES = {
  community_tenants: 'Tenants community',
  community_staff: 'Owners & agents',
  community_all: 'Everyone',
};

// ── keeping memberships in step with who is eligible ────────────────────

async function eligibleUserIds(organizationId, type) {
  const roleNames = {
    community_tenants: ['tenant'],
    community_staff: ['owner', 'agent'],
    community_all: [],
    support: ['administrator'],
  }[type];
  if (roleNames.length === 0) return [];
  const users = await prisma.user.findMany({
    where: { organizationId, status: 'active', userRoles: { some: { role: { name: { in: roleNames } } } } },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

// Makes a community or support room's member list match who should be in it
// right now: everyone eligible is added; anyone who no longer is (role
// changed, deactivated) is removed. Runs whenever rooms are listed.
async function syncRoomMembers(room) {
  const ids = new Set(await eligibleUserIds(room.organizationId, room.type));
  const existing = await prisma.chatMember.findMany({ where: { roomId: room.id }, select: { id: true, userId: true, platformAdminId: true } });

  const have = new Set(existing.filter((m) => m.userId).map((m) => m.userId));
  const toAdd = [...ids].filter((id) => !have.has(id));
  if (toAdd.length > 0) {
    await prisma.chatMember.createMany({ data: toAdd.map((userId) => ({ roomId: room.id, userId })), skipDuplicates: true });
  }
  const toRemove = existing.filter((m) => m.userId && !ids.has(m.userId)).map((m) => m.id);

  if (room.type === 'support') {
    const admins = await prisma.platformAdmin.findMany({ where: { isActive: true }, select: { id: true } });
    const adminIds = new Set(admins.map((a) => a.id));
    const haveAdmins = new Set(existing.filter((m) => m.platformAdminId).map((m) => m.platformAdminId));
    const adminsToAdd = [...adminIds].filter((id) => !haveAdmins.has(id));
    if (adminsToAdd.length > 0) {
      await prisma.chatMember.createMany({ data: adminsToAdd.map((platformAdminId) => ({ roomId: room.id, platformAdminId })), skipDuplicates: true });
    }
    toRemove.push(...existing.filter((m) => m.platformAdminId && !adminIds.has(m.platformAdminId)).map((m) => m.id));
  }
  if (toRemove.length > 0) {
    for (const m of existing.filter((x) => toRemove.includes(x.id))) {
      leaveActorFromRoom(m.userId ? refOf('user', m.userId) : refOf('platform', m.platformAdminId), room.id);
    }
    await prisma.chatMember.deleteMany({ where: { id: { in: toRemove } } });
  }
}

async function getOrCreateRoom({ organizationId, type, dedupeKey, name = null }) {
  return prisma.chatRoom.upsert({
    where: { dedupeKey },
    update: {},
    create: { organizationId, type, dedupeKey, name },
  });
}

// Keeping memberships in step costs several queries, and the room list is
// fetched on every incoming message — so each person is re-synced at most
// once a minute (rooms are also re-synced whenever one is opened).
const lastEnsured = new Map();
const ENSURE_EVERY_MS = 60_000;

async function ensureRoomsFor(actor) {
  const key = actorRef(actor);
  const last = lastEnsured.get(key);
  if (last && Date.now() - last < ENSURE_EVERY_MS) return;
  lastEnsured.set(key, Date.now());
  await ensureRoomsForUncached(actor);
}

async function ensureRoomsForUncached(actor) {
  if (actor.kind === 'platform') {
    const orgs = await prisma.organization.findMany({ where: { status: 'active' }, select: { id: true } });
    await Promise.all(orgs.map(async (org) => {
      const room = await getOrCreateRoom({ organizationId: org.id, type: 'support', dedupeKey: `${org.id}:support` });
      await syncRoomMembers(room);
    }));
    return;
  }

  const types = [];
  if (actor.roles.includes('tenant')) types.push('community_tenants');
  if (actor.roles.includes('owner') || actor.roles.includes('agent')) types.push('community_staff');
  // The old mixed "Everyone" room is emptied (tenants and owners must not share a room).
  if (isCommunityUser(actor)) types.push('community_all');
  if (isOrgAdmin(actor)) types.push('support');

  await Promise.all([...new Set(types)].map(async (type) => {
    const room = await getOrCreateRoom({ organizationId: actor.organizationId, type, dedupeKey: `${actor.organizationId}:${type}` });
    await syncRoomMembers(room);
  }));
}

// ── reading ─────────────────────────────────────────────────────────────

async function loadMembership(roomId, actor) {
  const membership = await prisma.chatMember.findFirst({ where: { roomId, ...memberKey(actor) }, include: { room: true } });
  // Never confirm a room exists to someone who is not in it.
  if (!membership) throw AppError.notFound('Conversation not found.');
  if (membership.room.type === 'direct' && await directRoomForbidden(roomId)) {
    throw AppError.forbidden('Tenants and owners cannot message or call each other. Please talk to the agent instead.');
  }
  return membership;
}

async function nameMap(members) {
  const userIds = members.filter((m) => m.userId).map((m) => m.userId);
  const adminIds = members.filter((m) => m.platformAdminId).map((m) => m.platformAdminId);
  const [users, admins] = await Promise.all([
    userIds.length ? prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, firstName: true, lastName: true, userRoles: { select: { role: { select: { name: true } } } } } }) : [],
    adminIds.length ? prisma.platformAdmin.findMany({ where: { id: { in: adminIds } }, select: { id: true, firstName: true, lastName: true } }) : [],
  ]);
  const map = new Map();
  for (const u of users) map.set(refOf('user', u.id), { name: `${u.firstName} ${u.lastName}`, role: roleLabel(u.userRoles.map((r) => r.role.name)) });
  for (const a of admins) map.set(refOf('platform', a.id), { name: `${a.firstName} ${a.lastName}`, role: 'platform_admin' });
  return map;
}

function serializeMessage(m) {
  return {
    id: m.id,
    roomId: m.roomId,
    sender: m.senderUserId ? refOf('user', m.senderUserId) : refOf('platform', m.senderPlatformAdminId),
    ciphertext: m.ciphertext,
    iv: m.iv,
    attachmentId: m.attachmentId,
    createdAt: m.createdAt,
  };
}

export async function listRooms(actor) {
  await ensureRoomsFor(actor);
  const memberships = await prisma.chatMember.findMany({
    where: memberKey(actor),
    include: { room: { include: { organization: { select: { name: true } }, members: true } } },
  });
  const roomIds = memberships.map((m) => m.roomId);
  if (roomIds.length === 0) return [];

  // One query each for unread counts, latest messages and the names of the
  // other person in each private chat — not one set per room.
  const mine = actor.kind === 'platform' ? Prisma.sql`m.platform_admin_id = ${actor.id}::uuid` : Prisma.sql`m.user_id = ${actor.id}::uuid`;
  const notMine = actor.kind === 'platform' ? Prisma.sql`msg.sender_platform_admin_id IS DISTINCT FROM ${actor.id}::uuid` : Prisma.sql`msg.sender_user_id IS DISTINCT FROM ${actor.id}::uuid`;
  const otherMembers = memberships
    .filter((m) => m.room.type === 'direct')
    .flatMap((m) => m.room.members.filter((x) => (actor.kind === 'platform' ? x.platformAdminId !== actor.id : x.userId !== actor.id)));

  const directOtherIds = [...new Set(otherMembers.filter((x) => x.userId).map((x) => x.userId))];
  const otherRolesByUser = new Map();
  if (actor.kind === 'user' && directOtherIds.length > 0) {
    const others = await prisma.user.findMany({ where: { id: { in: directOtherIds } }, select: { id: true, userRoles: { select: { role: { select: { name: true } } } } } });
    for (const o of others) otherRolesByUser.set(o.id, rolesOfUser(o));
  }

  const [unreadRows, lastMessages, names] = await Promise.all([
    prisma.$queryRaw`
      SELECT m.room_id AS "roomId", COUNT(msg.id)::int AS unread
      FROM chat_members m
      LEFT JOIN chat_messages msg ON msg.room_id = m.room_id
        AND (m.last_read_at IS NULL OR msg.created_at > m.last_read_at)
        AND ${notMine}
      WHERE ${mine}
      GROUP BY m.room_id`,
    prisma.chatMessage.findMany({ where: { roomId: { in: roomIds } }, distinct: ['roomId'], orderBy: [{ roomId: 'asc' }, { createdAt: 'desc' }] }),
    nameMap(otherMembers),
  ]);
  const unreadByRoom = new Map(unreadRows.map((r) => [r.roomId, r.unread]));
  const lastByRoom = new Map(lastMessages.map((m) => [m.roomId, m]));

  // Hide private chats that would put a tenant and an owner together.
  const visible = memberships.filter((m) => {
    if (m.room.type !== 'direct' || actor.kind !== 'user') return true;
    const other = m.room.members.find((x) => x.userId && x.userId !== actor.id);
    const otherRoles = other ? otherRolesByUser.get(other.userId) : null;
    return !otherRoles || !tenantOwnerPair(actor.roles, otherRoles);
  });

  const rooms = visible.map((m) => {
    const room = m.room;
    let title = ROOM_TITLES[room.type] ?? room.name;
    let other = null;
    if (room.type === 'direct') {
      const otherMember = room.members.find((x) => (actor.kind === 'platform' ? x.platformAdminId !== actor.id : x.userId !== actor.id));
      const ref = otherMember ? (otherMember.userId ? refOf('user', otherMember.userId) : refOf('platform', otherMember.platformAdminId)) : null;
      other = ref ? { ref, ...(names.get(ref) ?? { name: 'Unknown', role: 'member' }) } : null;
      title = other?.name ?? 'Conversation';
    } else if (room.type === 'support') {
      title = actor.kind === 'platform' ? `${room.organization?.name ?? 'Organization'} — support` : 'Platform support';
    }
    const last = lastByRoom.get(room.id);
    return {
      id: room.id, type: room.type, title, other, memberCount: room.members.length,
      unread: unreadByRoom.get(room.id) ?? 0,
      lastMessage: last ? serializeMessage(last) : null,
      createdAt: room.createdAt,
    };
  });

  rooms.sort((a, b) => new Date(b.lastMessage?.createdAt ?? b.createdAt) - new Date(a.lastMessage?.createdAt ?? a.createdAt));
  return rooms;
}

// Everything a browser needs to open a room: who is in it with their public
// keys (to encrypt to), and this person's own wrapped copy of the room key.
export async function getRoom(roomId, actor) {
  const mine = await loadMembership(roomId, actor);
  if (['community_tenants', 'community_staff', 'community_all', 'support'].includes(mine.room.type)) {
    await syncRoomMembers(mine.room);
  }
  const members = await prisma.chatMember.findMany({ where: { roomId } });
  const names = await nameMap(members);
  const keys = await prisma.chatKey.findMany({
    where: { OR: [{ userId: { in: members.filter((x) => x.userId).map((x) => x.userId) } }, { platformAdminId: { in: members.filter((x) => x.platformAdminId).map((x) => x.platformAdminId) } }] },
    select: { userId: true, platformAdminId: true, publicKey: true },
  });
  const keyByRef = new Map(keys.map((k) => [k.userId ? refOf('user', k.userId) : refOf('platform', k.platformAdminId), k.publicKey]));

  const me = await prisma.chatMember.findFirst({ where: { roomId, ...memberKey(actor) } });
  return {
    id: mine.room.id,
    type: mine.room.type,
    members: members.map((m) => {
      const ref = m.userId ? refOf('user', m.userId) : refOf('platform', m.platformAdminId);
      const info = names.get(ref) ?? { name: 'Unknown', role: 'member' };
      return { ref, name: info.name, role: info.role, publicKey: keyByRef.get(ref) ?? null, hasRoomKey: Boolean(m.wrappedKey) };
    }),
    myKey: me?.wrappedKey ? { wrappedKey: me.wrappedKey, wrapIv: me.wrapIv, wrapperPublicKey: me.wrapperPublicKey } : null,
  };
}

// ── direct conversations ────────────────────────────────────────────────

// Anyone in the tenant/owner/agent community of an organization can start a
// private conversation with anyone else in it (tenants with each other,
// tenants with the owners and agents of what they rent, owners with agents).
export async function openDirectRoom(actor, otherRef) {
  const other = parseRef(otherRef);
  if (other.kind !== 'user') throw AppError.forbidden('You cannot start a conversation with this person.');
  if (other.id === actor.id) throw AppError.badRequest('You cannot message yourself.');
  if (!isCommunityUser(actor)) throw AppError.forbidden('Private conversations are not available for your account.');

  const target = await prisma.user.findFirst({
    where: { id: other.id, organizationId: actor.organizationId, status: 'active', userRoles: { some: { role: { name: { in: COMMUNITY_ROLES } } } } },
    select: { id: true, userRoles: { select: { role: { select: { name: true } } } } },
  });
  if (!target) throw AppError.notFound('Person not found.');
  if (tenantOwnerPair(actor.roles, rolesOfUser(target))) {
    throw AppError.forbidden('Tenants and owners cannot message or call each other. Please talk to the agent instead.');
  }

  const [a, b] = [actor.id, target.id].sort();
  const room = await getOrCreateRoom({ organizationId: actor.organizationId, type: 'direct', dedupeKey: `direct:${a}:${b}` });
  const members = await prisma.chatMember.findMany({ where: { roomId: room.id } });
  if (members.length === 0) {
    await prisma.chatMember.createMany({ data: [{ roomId: room.id, userId: a }, { roomId: room.id, userId: b }], skipDuplicates: true });
    joinActorToRoom(refOf('user', a), room.id);
    joinActorToRoom(refOf('user', b), room.id);
    emitToActor(refOf('user', target.id), 'chat:room', { roomId: room.id });
  }
  return { roomId: room.id };
}

// The people a user may start a private conversation with.
export async function listDirectory(actor) {
  if (!isCommunityUser(actor)) return [];
  const users = await prisma.user.findMany({
    where: {
      organizationId: actor.organizationId, status: 'active', id: { not: actor.id },
      userRoles: { some: { role: { name: { in: COMMUNITY_ROLES } } } },
    },
    select: { id: true, firstName: true, lastName: true, userRoles: { select: { role: { select: { name: true } } } } },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
  });
  return users
    .filter((u) => !tenantOwnerPair(actor.roles, rolesOfUser(u)))
    .map((u) => ({ ref: refOf('user', u.id), name: `${u.firstName} ${u.lastName}`, role: roleLabel(rolesOfUser(u)) }));
}

// ── keys ────────────────────────────────────────────────────────────────

export async function getMyKeyBundle(actor) {
  const key = await prisma.chatKey.findFirst({ where: memberKey(actor) });
  if (!key) return null;
  return {
    publicKey: key.publicKey, encryptedPrivateKey: key.encryptedPrivateKey, keySalt: key.keySalt, keyIv: key.keyIv, kdfIterations: key.kdfIterations,
  };
}

// First setup stores the key pair. Afterwards the passphrase can be changed
// (same key pair, re-encrypted). A `reset` (lost passphrase) replaces the
// key pair — and every room key wrapped for the old one is discarded so the
// other members' browsers re-wrap it; messages sent before are not readable
// with the new keys.
export async function saveMyKeyBundle(actor, bundle, { reset = false } = {}) {
  const existing = await prisma.chatKey.findFirst({ where: memberKey(actor) });
  if (existing && !reset && existing.publicKey !== bundle.publicKey) {
    throw AppError.conflict('You already have a chat key. Use reset to replace it.');
  }
  const data = { ...bundle };
  if (existing) {
    await prisma.chatKey.update({ where: { id: existing.id }, data });
    if (reset && existing.publicKey !== bundle.publicKey) {
      await prisma.chatMember.updateMany({ where: memberKey(actor), data: { wrappedKey: null, wrapIv: null, wrapperPublicKey: null } });
    }
  } else {
    await prisma.chatKey.create({ data: { ...data, ...memberKey(actor) } });
  }
  return { saved: true };
}

// Stores room keys wrapped (in a member's browser) for other members. The
// server cannot read them; it only checks the uploader is entitled to
// distribute: the room has no key yet (then this is its first, atomically),
// or the uploader already holds the key.
export async function distributeRoomKeys(roomId, actor, entries) {
  const mine = await loadMembership(roomId, actor);

  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM chat_rooms WHERE id = ${roomId}::uuid FOR UPDATE`;
    const holders = await tx.chatMember.count({ where: { roomId, wrappedKey: { not: null } } });
    const iHold = Boolean(mine.wrappedKey);
    if (holders > 0 && !iHold) throw AppError.conflict('This conversation already has a key. Reload to receive it.');

    for (const entry of entries) {
      const target = parseRef(entry.ref);
      const where = { roomId, wrappedKey: null, ...(target.kind === 'platform' ? { platformAdminId: target.id } : { userId: target.id }) };
      await tx.chatMember.updateMany({
        where,
        data: { wrappedKey: entry.wrappedKey, wrapIv: entry.wrapIv, wrapperPublicKey: entry.wrapperPublicKey },
      });
    }
  });

  // Tell members whose key just arrived so they can open the conversation.
  for (const entry of entries) emitToActor(entry.ref, 'chat:key', { roomId });
  return { stored: true };
}

// ── messages ────────────────────────────────────────────────────────────

export async function listMessages(roomId, actor, { before, limit }) {
  await loadMembership(roomId, actor);
  const take = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const where = { roomId, ...(before ? { createdAt: { lt: new Date(before) } } : {}) };
  const messages = await prisma.chatMessage.findMany({ where, orderBy: { createdAt: 'desc' }, take });
  return messages.reverse().map(serializeMessage);
}

export async function sendMessage(roomId, actor, { ciphertext, iv, attachmentId }) {
  const mine = await loadMembership(roomId, actor);
  if (!mine.wrappedKey) throw AppError.conflict('Secure chat is not set up for you in this conversation yet.');

  if (attachmentId) {
    const attachment = await prisma.chatAttachment.findFirst({
      where: { id: attachmentId, roomId, message: null, ...(actor.kind === 'platform' ? { uploaderPlatformAdminId: actor.id } : { uploaderUserId: actor.id }) },
    });
    if (!attachment) throw AppError.badRequest('That file is not available to attach.');
  }

  const message = await prisma.chatMessage.create({
    data: {
      roomId, ciphertext, iv, attachmentId: attachmentId ?? null,
      ...(actor.kind === 'platform' ? { senderPlatformAdminId: actor.id } : { senderUserId: actor.id }),
    },
  });
  // The sender has obviously read up to here.
  await prisma.chatMember.update({ where: { id: mine.id }, data: { lastReadAt: message.createdAt } });

  const serialized = serializeMessage(message);
  emitToRoom(roomId, 'chat:message', serialized);
  return serialized;
}

export async function markRead(roomId, actor) {
  const mine = await loadMembership(roomId, actor);
  await prisma.chatMember.update({ where: { id: mine.id }, data: { lastReadAt: new Date() } });
  return { read: true };
}

// ── attachments (opaque encrypted bytes) ────────────────────────────────

export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

export async function saveAttachment(roomId, actor, buffer) {
  await loadMembership(roomId, actor);
  if (!buffer || buffer.length === 0) throw AppError.badRequest('No file received.');
  if (buffer.length > MAX_ATTACHMENT_BYTES) throw AppError.badRequest('That file is too large (25 MB maximum).');
  const attachment = await prisma.chatAttachment.create({
    data: {
      roomId, data: buffer, size: buffer.length,
      ...(actor.kind === 'platform' ? { uploaderPlatformAdminId: actor.id } : { uploaderUserId: actor.id }),
    },
    select: { id: true, size: true },
  });
  return attachment;
}

export async function getAttachment(attachmentId, actor) {
  const attachment = await prisma.chatAttachment.findUnique({ where: { id: attachmentId } });
  if (!attachment) throw AppError.notFound('File not found.');
  await loadMembership(attachment.roomId, actor);
  return attachment;
}

// ── calls: who may take part ────────────────────────────────────────────

export async function assertRoomMember(roomId, actor) {
  return loadMembership(roomId, actor);
}

export async function displayNameFor(actor) {
  const names = await nameMap([actor.kind === 'platform' ? { platformAdminId: actor.id } : { userId: actor.id }]);
  return names.get(actorRef(actor))?.name ?? 'Someone';
}
