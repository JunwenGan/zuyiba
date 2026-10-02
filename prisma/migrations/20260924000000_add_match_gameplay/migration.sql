ALTER TYPE "MatchRoomStatus" ADD VALUE 'FINISHED';
ALTER TABLE "MatchRoom"
  ADD COLUMN "answerPlayerId" TEXT,
  ADD COLUMN "winnerId" TEXT,
  ADD COLUMN "startedAt" TIMESTAMP(3),
  ADD COLUMN "completedAt" TIMESTAMP(3);

-- Legacy lobbies could be marked PLAYING without an answer. Make them startable.
UPDATE "MatchRoom" SET status = 'WAITING' WHERE status = 'PLAYING';

CREATE TABLE "MatchGuess" (
  "id" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "participantId" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "guessNumber" INTEGER NOT NULL,
  "feedback" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MatchGuess_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MatchGuess_roomId_participantId_playerId_key" ON "MatchGuess"("roomId", "participantId", "playerId");
CREATE UNIQUE INDEX "MatchGuess_roomId_participantId_guessNumber_key" ON "MatchGuess"("roomId", "participantId", "guessNumber");
ALTER TABLE "MatchRoom" ADD CONSTRAINT "MatchRoom_answerPlayerId_fkey" FOREIGN KEY ("answerPlayerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MatchGuess" ADD CONSTRAINT "MatchGuess_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "MatchRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MatchGuess" ADD CONSTRAINT "MatchGuess_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
