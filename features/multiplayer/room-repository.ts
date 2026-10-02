import { randomInt, randomUUID } from 'node:crypto';
import { ELITE_CLUBS } from '../../types/database';
import { lockRoom } from './lock-room';
import { RoomError } from './room-error';
import type { Prisma, PrismaClient } from '../../lib/generated/prisma/client';
import { createRoom, joinRoom, setReady, startMatch, type MatchRoom } from './room';

const roomSelect = {
  id: true,
  hostId: true,
  status: true,
  participants: {
    select: { participantId: true, isReady: true },
    orderBy: [{ joinedAt: 'asc' }, { participantId: 'asc' }],
  },
} satisfies Prisma.MatchRoomSelect;

type StoredRoom = Prisma.MatchRoomGetPayload<{ select: typeof roomSelect }>;

export function toRoom(stored: StoredRoom): MatchRoom {
  return {
    id: stored.id,
    hostId: stored.hostId,
    status: stored.status,
    participants: stored.participants.map((p) => ({ id: p.participantId, isReady: p.isReady })),
  };
}

/** Server-side persistence, not an API. Callers must supply authenticated IDs.
 * All lobby writes must go through this repository to preserve capacity rules.
 */
export function createRoomRepository(db: PrismaClient) {
  async function change(roomId: string, apply: (room: MatchRoom) => MatchRoom) {
    return db.$transaction(
      async (tx) => {
        // Serialize changes to THIS room, not all rooms. Released on commit/rollback.
        await lockRoom(tx, roomId);
        const stored = await tx.matchRoom.findUniqueOrThrow({
          where: { id: roomId },
          select: roomSelect,
        });
        const current = toRoom(stored);
        const next = apply(current);
        if (next === current) return current;

        const data: Prisma.MatchRoomUpdateInput = { status: next.status };
        if (current.status === 'WAITING' && next.status === 'PLAYING') {
          // Fetch eligible IDs in one query so selection uses one consistent pool.
          const eligible = await tx.player.findMany({
            where: { active: true, club: { in: [...ELITE_CLUBS] } },
            select: { id: true },
          });
          if (!eligible.length) throw new RoomError('CONFLICT', 'No eligible players available');
          data.answerPlayer = { connect: { id: eligible[randomInt(eligible.length)].id } };
          data.startedAt = new Date();
          await tx.matchParticipant.updateMany({
            where: { roomId },
            data: { lastSeenAt: data.startedAt },
          });
        }
        await tx.matchRoom.update({ where: { id: roomId }, data });
        for (const participant of next.participants) {
          await tx.matchParticipant.upsert({
            where: { roomId_participantId: { roomId, participantId: participant.id } },
            create: { roomId, participantId: participant.id, isReady: participant.isReady },
            update: { isReady: participant.isReady },
          });
        }
        return next;
      },
      { isolationLevel: 'ReadCommitted' }
    );
  }

  return {
    async create(hostId: string): Promise<MatchRoom> {
      const room = createRoom(randomUUID(), hostId);
      const stored = await db.matchRoom.create({
        data: {
          id: room.id,
          hostId: room.hostId,
          participants: { create: { participantId: hostId } },
        },
        select: roomSelect,
      });
      return toRoom(stored);
    },
    async find(roomId: string): Promise<MatchRoom | null> {
      const stored = await db.matchRoom.findUnique({ where: { id: roomId }, select: roomSelect });
      return stored ? toRoom(stored) : null;
    },
    join: (roomId: string, participantId: string) =>
      change(roomId, (room) => joinRoom(room, participantId)),
    ready: (roomId: string, participantId: string, isReady: boolean) =>
      change(roomId, (room) => setReady(room, participantId, isReady)),
    start: (roomId: string, participantId: string) =>
      change(roomId, (room) => startMatch(room, participantId)),
  };
}
