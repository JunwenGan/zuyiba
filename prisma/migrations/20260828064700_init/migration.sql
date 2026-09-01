-- CreateEnum
CREATE TYPE "League" AS ENUM ('PREMIER_LEAGUE', 'LA_LIGA', 'BUNDESLIGA', 'SERIE_A', 'LIGUE_1');

-- CreateEnum
CREATE TYPE "PositionGroup" AS ENUM ('GOALKEEPER', 'DEFENDER', 'MIDFIELDER', 'FORWARD');

-- CreateEnum
CREATE TYPE "PreferredFoot" AS ENUM ('LEFT', 'RIGHT', 'BOTH');

-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('PLAYING', 'WON', 'LOST');

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nationality" TEXT NOT NULL,
    "countryCode" VARCHAR(3) NOT NULL,
    "club" TEXT NOT NULL,
    "league" "League" NOT NULL,
    "position" TEXT NOT NULL,
    "positionGroup" "PositionGroup" NOT NULL,
    "birthDate" DATE NOT NULL,
    "heightCm" INTEGER NOT NULL,
    "preferredFoot" "PreferredFoot" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "popularity" INTEGER NOT NULL DEFAULT 50,
    "imageUrl" TEXT,
    "clubLogoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameSession" (
    "id" TEXT NOT NULL,
    "status" "GameStatus" NOT NULL DEFAULT 'PLAYING',
    "attemptsUsed" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 8,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "answerPlayerId" TEXT NOT NULL,

    CONSTRAINT "GameSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Guess" (
    "id" TEXT NOT NULL,
    "guessNumber" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gameSessionId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,

    CONSTRAINT "Guess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Player_slug_key" ON "Player"("slug");

-- CreateIndex
CREATE INDEX "Player_league_idx" ON "Player"("league");

-- CreateIndex
CREATE INDEX "Player_active_idx" ON "Player"("active");

-- CreateIndex
CREATE INDEX "Player_popularity_idx" ON "Player"("popularity");

-- CreateIndex
CREATE INDEX "Player_name_idx" ON "Player"("name");

-- CreateIndex
CREATE INDEX "GameSession_status_idx" ON "GameSession"("status");

-- CreateIndex
CREATE INDEX "GameSession_createdAt_idx" ON "GameSession"("createdAt");

-- CreateIndex
CREATE INDEX "Guess_gameSessionId_idx" ON "Guess"("gameSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Guess_gameSessionId_playerId_key" ON "Guess"("gameSessionId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "Guess_gameSessionId_guessNumber_key" ON "Guess"("gameSessionId", "guessNumber");

-- AddForeignKey
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_answerPlayerId_fkey" FOREIGN KEY ("answerPlayerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guess" ADD CONSTRAINT "Guess_gameSessionId_fkey" FOREIGN KEY ("gameSessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guess" ADD CONSTRAINT "Guess_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
