import type { Prisma, PrismaClient } from '../../lib/generated/prisma/client';
import { MAX_ATTEMPTS } from '../../types/database';
import type { GuessWithComparison, PlayerData } from '../game/types';
import { comparePlayer, isWinningGuess } from '../game/utils/comparison';
import { toPlayerData } from '../game/utils/player-data';
import { lockRoom } from './lock-room';
import { RoomError } from './room-error';
import { toRoom } from './room-repository';
import type { MatchRoom } from './room';
import { toOpponentGuess, type OpponentGuess } from './opponent-guess';

export interface MatchState extends MatchRoom {
  winnerId: string | null;
  finishReason: string | null;
  rematchRoomId: string | null;
  startedAt: string | null;
  completedAt: string | null;
  guesses: GuessWithComparison[];
  opponentGuesses: OpponentGuess[];
  answer: PlayerData | null;
}

async function state(
  tx: Prisma.TransactionClient,
  roomId: string,
  participantId: string
): Promise<MatchState> {
  const room = await tx.matchRoom.findUnique({
    where: { id: roomId },
    include: { participants: true, answerPlayer: true },
  });
  if (!room || !room.participants.some((p) => p.participantId === participantId)) {
    throw new RoomError('NOT_FOUND', 'Room not found');
  }
  const guesses = await tx.matchGuess.findMany({
    where: { roomId, participantId: { in: room.participants.map((p) => p.participantId) } },
    orderBy: { guessNumber: 'asc' },
    select: { participantId: true, feedback: true },
  });
  // Explicit public projection: never spread the database room into an API result.
  return {
    ...toRoom(room),
    winnerId: room.winnerId,
    finishReason: room.finishReason,
    rematchRoomId: room.rematchRoomId,
    startedAt: room.startedAt?.toISOString() ?? null,
    completedAt: room.completedAt?.toISOString() ?? null,
    guesses: guesses
      .filter((guess) => guess.participantId === participantId)
      .map((guess) => guess.feedback as unknown as GuessWithComparison),
    opponentGuesses: guesses
      .filter((guess) => guess.participantId !== participantId)
      .map((guess) => toOpponentGuess(guess.feedback as unknown as GuessWithComparison)),
    answer:
      room.status === 'FINISHED' && room.answerPlayer
        ? toPlayerData(room.answerPlayer, room.startedAt ?? undefined)
        : null,
  };
}

export function createMatchRepository(db: PrismaClient) {
  return {
    // A consistent snapshot prevents mixing a pre-win status with post-win guesses.
    read: (roomId: string, participantId: string) =>
      db.$transaction((tx) => state(tx, roomId, participantId), {
        isolationLevel: 'RepeatableRead',
      }),
    guess: (roomId: string, participantId: string, playerId: string) =>
      db.$transaction(
        async (tx) => {
          await lockRoom(tx, roomId);
          const room = await tx.matchRoom.findUniqueOrThrow({
            where: { id: roomId },
            include: { participants: true, answerPlayer: true },
          });
          if (!room.participants.some((p) => p.participantId === participantId)) {
            throw new RoomError('FORBIDDEN', 'You are not a participant in this room');
          }
          // Retrying an accepted guess does not add another attempt, even after a win.
          const previous = await tx.matchGuess.findUnique({
            where: { roomId_participantId_playerId: { roomId, participantId, playerId } },
          });
          if (previous) return state(tx, roomId, participantId);
          if (room.status !== 'PLAYING')
            throw new RoomError('CONFLICT', 'The match is not playing');
          if (!room.answerPlayer || !room.startedAt) throw new Error('Playing match has no answer');
          const attemptsUsed = await tx.matchGuess.count({ where: { roomId, participantId } });
          if (attemptsUsed >= MAX_ATTEMPTS)
            throw new RoomError('CONFLICT', 'You have used all 8 guesses');
          const player = await tx.player.findFirst({ where: { id: playerId, active: true } });
          if (!player) throw new RoomError('NOT_FOUND', 'Player not found');
          const guessed = toPlayerData(player, room.startedAt);
          const answer = toPlayerData(room.answerPlayer, room.startedAt);
          const guessNumber = attemptsUsed + 1;
          const createdAt = new Date();
          const feedback: GuessWithComparison = {
            guessNumber,
            player: guessed,
            comparison: comparePlayer(guessed, answer),
            createdAt: createdAt.toISOString(),
          };
          await tx.matchGuess.create({
            data: {
              roomId,
              participantId,
              playerId,
              guessNumber,
              createdAt,
              feedback: JSON.parse(JSON.stringify(feedback)) as Prisma.InputJsonValue,
            },
          });
          if (isWinningGuess(player.id, room.answerPlayer.id)) {
            // Guess and winner commit together, under the same lock used by both players.
            await tx.matchRoom.update({
              where: { id: roomId },
              data: {
                status: 'FINISHED',
                winnerId: participantId,
                finishReason: 'CORRECT',
                completedAt: createdAt,
              },
            });
          } else if (guessNumber === MAX_ATTEMPTS) {
            const opponentId = room.participants.find(
              (p) => p.participantId !== participantId
            )?.participantId;
            const opponentAttempts = opponentId
              ? await tx.matchGuess.count({ where: { roomId, participantId: opponentId } })
              : 0;
            if (opponentAttempts >= MAX_ATTEMPTS) {
              await tx.matchRoom.update({
                where: { id: roomId },
                data: {
                  status: 'FINISHED',
                  winnerId: null,
                  completedAt: createdAt,
                  finishReason: 'DRAW',
                },
              });
            }
          }
          return state(tx, roomId, participantId);
        },
        { isolationLevel: 'ReadCommitted' }
      ),
  };
}
