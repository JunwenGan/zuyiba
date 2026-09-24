/**
 * Step 1: lobby rules, independent of the database, sockets and UI.
 * These functions return a new state; they do not save it anywhere.
 * A future server handler must resolve participant IDs from authenticated
 * sessions and apply these rules atomically to the latest database state.
 */
import { RoomError } from './room-error';

export interface RoomParticipant {
  readonly id: string;
  readonly isReady: boolean;
}

export interface MatchRoom {
  readonly id: string;
  readonly hostId: string;
  readonly status: 'WAITING' | 'PLAYING';
  readonly participants: readonly RoomParticipant[];
}

export function createRoom(roomId: string, hostId: string): MatchRoom {
  if (!roomId.trim() || !hostId.trim()) {
    throw new RoomError('INVALID_INPUT', 'Room and host IDs are required');
  }
  return {
    id: roomId,
    hostId,
    status: 'WAITING',
    participants: [{ id: hostId, isReady: false }],
  };
}

function requireWaiting(room: MatchRoom): void {
  if (room.status !== 'WAITING') {
    throw new RoomError('CONFLICT', 'The match has already started');
  }
}

export function joinRoom(room: MatchRoom, participantId: string): MatchRoom {
  if (!participantId.trim()) throw new RoomError('INVALID_INPUT', 'Participant ID is required');
  // Retrying a join must not occupy another seat or reset readiness.
  if (room.participants.some((participant) => participant.id === participantId)) return room;
  requireWaiting(room);
  if (room.participants.length >= 2) throw new RoomError('CONFLICT', 'The room is full');

  return {
    ...room,
    participants: [...room.participants, { id: participantId, isReady: false }],
  };
}

export function setReady(room: MatchRoom, participantId: string, isReady: boolean): MatchRoom {
  requireWaiting(room);
  if (!room.participants.some((participant) => participant.id === participantId)) {
    throw new RoomError('FORBIDDEN', 'You are not a participant in this room');
  }
  return {
    ...room,
    participants: room.participants.map((participant) =>
      participant.id === participantId ? { ...participant, isReady } : participant
    ),
  };
}

export function startMatch(room: MatchRoom, participantId: string): MatchRoom {
  requireWaiting(room);
  if (participantId !== room.hostId)
    throw new RoomError('FORBIDDEN', 'Only the host can start the match');
  if (
    room.participants.length !== 2 ||
    !room.participants.every((participant) => participant.isReady)
  ) {
    throw new RoomError('CONFLICT', 'Two ready participants are required');
  }
  return { ...room, status: 'PLAYING' };
}
