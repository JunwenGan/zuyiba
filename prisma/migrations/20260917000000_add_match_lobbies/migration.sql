CREATE TYPE "MatchRoomStatus" AS ENUM ('WAITING', 'PLAYING');

CREATE TABLE "MatchRoom" (
    "id" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "status" "MatchRoomStatus" NOT NULL DEFAULT 'WAITING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MatchRoom_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MatchParticipant" (
    "roomId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "isReady" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MatchParticipant_pkey" PRIMARY KEY ("roomId", "participantId")
);

ALTER TABLE "MatchParticipant" ADD CONSTRAINT "MatchParticipant_roomId_fkey"
FOREIGN KEY ("roomId") REFERENCES "MatchRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
