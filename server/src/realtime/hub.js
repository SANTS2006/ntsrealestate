// A tiny indirection so services can push real-time events without importing
// the socket server (which itself imports services). Every function is a
// no-op until the server has started Socket.IO, so unit tests and scripts
// that never open a socket still work.
let io = null;

export function setIo(instance) {
  io = instance;
}

export function getIo() {
  return io;
}

// Events for everyone currently in a conversation.
export function emitToRoom(roomId, event, payload) {
  io?.to(`room:${roomId}`).emit(event, payload);
}

// Events for one person, on whichever devices they have open ("u:<id>" or
// "p:<id>").
export function emitToActor(ref, event, payload) {
  io?.to(`actor:${ref}`).emit(event, payload);
}

export function joinActorToRoom(ref, roomId) {
  io?.in(`actor:${ref}`).socketsJoin(`room:${roomId}`);
}

export function leaveActorFromRoom(ref, roomId) {
  io?.in(`actor:${ref}`).socketsLeave(`room:${roomId}`);
}
