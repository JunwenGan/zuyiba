import { EventEmitter } from 'node:events';

// One Node process, shared across the custom server and Next's bundled handlers.
// Only invalidation hints live here. PostgreSQL remains the source of truth.
const shared = globalThis as typeof globalThis & { zuyibaRoomEvents?: EventEmitter };
export const roomEvents = (shared.zuyibaRoomEvents ??= new EventEmitter());
export function notifyRoom(roomId: string) {
  roomEvents.emit('changed', roomId);
}
