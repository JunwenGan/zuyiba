import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '../../lib/generated/prisma/client';
import { lockRoom } from './lock-room';
import { RoomError } from './room-error';

export const RECONNECT_GRACE_MS = 60_000;

/** All final outcomes and rematch creation serialize against guesses on the room lock. */
export function createMatchLifecycle(db: PrismaClient) {
  return {
    leave: (roomId: string, participantId: string) =>
      db.$transaction(async (tx) => {
        await lockRoom(tx, roomId);
        const room = await tx.matchRoom.findUniqueOrThrow({
          where: { id: roomId },
          include: { participants: true },
        });
        if (!room.participants.some((p) => p.participantId === participantId))
          throw new RoomError('FORBIDDEN', 'You are not a participant in this room');
        if (room.status === 'FINISHED') return;
        if (room.status !== 'PLAYING') throw new RoomError('CONFLICT', 'The match is not playing');
        await tx.matchRoom.update({
          where: { id: roomId },
          data: {
            status: 'FINISHED',
            finishReason: 'FORFEIT',
            completedAt: new Date(),
            winnerId: room.participants.find((p) => p.participantId !== participantId)!
              .participantId,
          },
        });
      }),
    restart: (roomId: string, participantId: string) =>
      db.$transaction(async (tx) => {
        await lockRoom(tx, roomId);
        const room = await tx.matchRoom.findUniqueOrThrow({
          where: { id: roomId },
          include: { participants: true },
        });
        if (!room.participants.some((p) => p.participantId === participantId))
          throw new RoomError('FORBIDDEN', 'You are not a participant in this room');
        if (room.status !== 'FINISHED') throw new RoomError('CONFLICT', 'Finish the match first');
        if (room.rematchRoomId) return { roomId: room.rematchRoomId };
        const next = await tx.matchRoom.create({
          data: {
            id: randomUUID(),
            hostId: room.hostId,
            participants: {
              create: room.participants.map((p) => ({ participantId: p.participantId })),
            },
          },
        });
        await tx.matchRoom.update({ where: { id: roomId }, data: { rematchRoomId: next.id } });
        return { roomId: next.id };
      }),
    // Called by the single socket-server process, never by a public endpoint.
    reconcile: (roomId: string, online: ReadonlySet<string>, now = new Date()) =>
      db.$transaction(async (tx) => {
        await lockRoom(tx, roomId);
        const room = await tx.matchRoom.findUniqueOrThrow({
          where: { id: roomId },
          include: { participants: true },
        });
        if (room.status !== 'PLAYING') return false;
        const absent = room.participants.filter((p) => !online.has(p.participantId));
        const expired = absent.filter(
          (p) => now.getTime() - p.lastSeenAt.getTime() >= RECONNECT_GRACE_MS
        );
        const abandoned = absent.length === 2 && expired.length === 2;
        const forfeited = absent.length === 1 && expired.length === 1;
        if (abandoned || forfeited) {
          await tx.matchRoom.update({
            where: { id: roomId },
            data: {
              status: 'FINISHED',
              completedAt: now,
              finishReason: abandoned ? 'ABANDONED' : 'DISCONNECT',
              winnerId: abandoned
                ? null
                : room.participants.find((p) => online.has(p.participantId))!.participantId,
            },
          });
          return true;
        }
        await tx.matchParticipant.updateMany({
          where: { roomId, participantId: { in: [...online] } },
          data: { lastSeenAt: now },
        });
        return false;
      }),
  };
}
