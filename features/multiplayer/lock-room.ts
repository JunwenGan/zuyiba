import type { Prisma } from '../../lib/generated/prisma/client';
import { RoomError } from './room-error';

export async function lockRoom(tx: Prisma.TransactionClient, roomId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM "MatchRoom" WHERE id = ${roomId} FOR UPDATE
  `;
  if (rows.length === 0) throw new RoomError('NOT_FOUND', 'Room not found');
}
