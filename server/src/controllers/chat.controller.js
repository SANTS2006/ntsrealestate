import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { AppError } from '../utils/AppError.js';
import { env } from '../config/env.js';
import * as chat from '../services/chat.service.js';

export const getKeys = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await chat.getMyKeyBundle(req.chatActor) });
});

export const saveKeys = asyncHandler(async (req, res) => {
  const { reset, ...bundle } = req.body;
  sendSuccess(res, { data: await chat.saveMyKeyBundle(req.chatActor, bundle, { reset }) });
});

export const listRooms = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await chat.listRooms(req.chatActor) });
});

export const getRoom = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await chat.getRoom(req.params.roomId, req.chatActor) });
});

export const openDirect = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await chat.openDirectRoom(req.chatActor, req.body.ref) });
});

export const directory = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await chat.listDirectory(req.chatActor) });
});

export const distributeKeys = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await chat.distributeRoomKeys(req.params.roomId, req.chatActor, req.body.keys) });
});

export const listMessages = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await chat.listMessages(req.params.roomId, req.chatActor, req.query) });
});

export const sendMessage = asyncHandler(async (req, res) => {
  sendSuccess(res, { statusCode: 201, data: await chat.sendMessage(req.params.roomId, req.chatActor, req.body) });
});

export const markRead = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await chat.markRead(req.params.roomId, req.chatActor) });
});

export const uploadAttachment = asyncHandler(async (req, res) => {
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) throw AppError.badRequest('No file received.');
  sendSuccess(res, { statusCode: 201, data: await chat.saveAttachment(req.params.roomId, req.chatActor, req.body) });
});

export const downloadAttachment = asyncHandler(async (req, res) => {
  const attachment = await chat.getAttachment(req.params.attachmentId, req.chatActor);
  res.set({ 'Content-Type': 'application/octet-stream', 'Cache-Control': 'private, no-store', 'Content-Length': String(attachment.size) });
  res.send(Buffer.from(attachment.data));
});

// STUN is enough for most networks; a TURN relay (set TURN_URLS, TURN_USERNAME
// and TURN_CREDENTIAL) is what makes calls work across strict firewalls.
export const iceServers = asyncHandler(async (req, res) => {
  const servers = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
  if (env.TURN_URLS) {
    servers.push({ urls: env.TURN_URLS.split(',').map((u) => u.trim()).filter(Boolean), username: env.TURN_USERNAME, credential: env.TURN_CREDENTIAL });
  }
  sendSuccess(res, { data: { iceServers: servers } });
});
