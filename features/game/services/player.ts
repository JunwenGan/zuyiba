/**
 * Player service for database operations.
 */

import { prisma } from '@/lib/database';
import type { Player } from '@/lib/generated/prisma/client';
import type { PlayerData, PlayerSummary } from '@/features/game/types';
import { calculateAge } from '@/features/game/utils';
import { ELITE_CLUBS, type GameMode } from '@/types/database';

/**
 * Convert a database Player to PlayerData for API responses.
 */
export function toPlayerData(player: Player, referenceDate?: Date): PlayerData {
  return {
    id: player.id,
    name: player.name,
    nationality: player.nationality,
    countryCode: player.countryCode,
    club: player.club,
    league: player.league,
    position: player.position,
    positionGroup: player.positionGroup,
    age: calculateAge(player.birthDate, referenceDate),
    heightCm: player.heightCm,
    preferredFoot: player.preferredFoot,
    imageUrl: player.imageUrl,
    clubLogoUrl: player.clubLogoUrl,
  };
}

/**
 * Convert a database Player to PlayerSummary for search results.
 */
export function toPlayerSummary(player: Player): PlayerSummary {
  return {
    id: player.id,
    name: player.name,
    club: player.club,
    league: player.league,
    nationality: player.nationality,
    countryCode: player.countryCode,
    imageUrl: player.imageUrl,
    clubLogoUrl: player.clubLogoUrl,
  };
}

/**
 * Get a random eligible active player.
 * @param mode - Game mode: NORMAL filters to elite clubs, HARD includes all players
 * Returns null if no eligible players exist.
 */
export async function getRandomActivePlayer(mode: GameMode = 'NORMAL'): Promise<Player | null> {
  // Build where clause based on mode
  const whereClause =
    mode === 'NORMAL'
      ? { active: true, club: { in: [...ELITE_CLUBS] } }
      : { active: true };

  // Get count of eligible players
  const count = await prisma.player.count({
    where: whereClause,
  });

  if (count === 0) {
    return null;
  }

  // Select a random offset
  const randomOffset = Math.floor(Math.random() * count);

  // Fetch one player at that offset
  const players = await prisma.player.findMany({
    where: whereClause,
    skip: randomOffset,
    take: 1,
  });

  return players[0] ?? null;
}

/**
 * Get a player by ID.
 */
export async function getPlayerById(id: string): Promise<Player | null> {
  return prisma.player.findUnique({
    where: { id },
  });
}

/**
 * Search for players by name (case-insensitive).
 * Returns up to `limit` results, ordered by popularity desc, then name length asc
 * (shorter names first, so "Rodri" comes before "Rodriguez").
 */
export async function searchPlayers(query: string, limit: number = 10): Promise<Player[]> {
  // Use raw query to sort by name length as secondary sort
  // This ensures exact/shorter matches appear first
  const players = await prisma.$queryRaw<Player[]>`
    SELECT * FROM "Player"
    WHERE active = true
    AND name ILIKE ${'%' + query + '%'}
    ORDER BY popularity DESC, LENGTH(name) ASC, name ASC
    LIMIT ${limit}
  `;
  return players;
}
