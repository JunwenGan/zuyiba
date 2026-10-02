import type { Player } from '../../../lib/generated/prisma/client';
import type { PlayerData } from '../types';
import { calculateAge } from './age';

/** Pure serializer shared by single-player and multiplayer (no database client). */
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
