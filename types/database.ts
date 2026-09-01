/**
 * Database types that mirror Prisma enums.
 * These are used throughout the application for type safety.
 */

export const LEAGUES = ['PREMIER_LEAGUE', 'LA_LIGA', 'BUNDESLIGA', 'SERIE_A', 'LIGUE_1'] as const;

export type League = (typeof LEAGUES)[number];

export const LEAGUE_DISPLAY_NAMES: Record<League, string> = {
  PREMIER_LEAGUE: 'Premier League',
  LA_LIGA: 'La Liga',
  BUNDESLIGA: 'Bundesliga',
  SERIE_A: 'Serie A',
  LIGUE_1: 'Ligue 1',
};

export const POSITION_GROUPS = ['GOALKEEPER', 'DEFENDER', 'MIDFIELDER', 'FORWARD'] as const;

export type PositionGroup = (typeof POSITION_GROUPS)[number];

export const POSITION_GROUP_DISPLAY_NAMES: Record<PositionGroup, string> = {
  GOALKEEPER: 'Goalkeeper',
  DEFENDER: 'Defender',
  MIDFIELDER: 'Midfielder',
  FORWARD: 'Forward',
};

export const PREFERRED_FEET = ['LEFT', 'RIGHT', 'BOTH'] as const;

export type PreferredFoot = (typeof PREFERRED_FEET)[number];

export const PREFERRED_FOOT_DISPLAY_NAMES: Record<PreferredFoot, string> = {
  LEFT: 'Left',
  RIGHT: 'Right',
  BOTH: 'Both',
};

export const GAME_STATUSES = ['PLAYING', 'WON', 'LOST'] as const;

export type GameStatus = (typeof GAME_STATUSES)[number];

export const MAX_ATTEMPTS = 8;

// Game modes
export const GAME_MODES = ['NORMAL', 'HARD'] as const;

export type GameMode = (typeof GAME_MODES)[number];

// Elite clubs for NORMAL mode (~600 players)
export const ELITE_CLUBS = [
  // Premier League (6)
  'Manchester City FC',
  'Arsenal FC',
  'Liverpool FC',
  'Chelsea FC',
  'Manchester United FC',
  'Tottenham Hotspur FC',
  // La Liga (4)
  'Real Madrid CF',
  'FC Barcelona',
  'Club Atlético de Madrid',
  'Sevilla FC',
  // Bundesliga (3)
  'FC Bayern München',
  'Borussia Dortmund',
  'Bayer 04 Leverkusen',
  // Serie A (4)
  'FC Internazionale Milano',
  'AC Milan',
  'Juventus FC',
  'SSC Napoli',
  // Ligue 1 (2)
  'Paris Saint-Germain FC',
  'AS Monaco FC',
] as const;
