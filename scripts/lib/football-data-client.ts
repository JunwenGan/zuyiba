/**
 * football-data.org API client.
 * Free tier: 10 requests/minute.
 */

const API_BASE_URL = 'https://api.football-data.org/v4';

// Rate limiting: 10 requests per minute = 1 request per 6 seconds
const RATE_LIMIT_DELAY_MS = 6500; // 6.5 seconds to be safe

// Big Five league codes
export const LEAGUE_CODES = {
  PREMIER_LEAGUE: 'PL',
  LA_LIGA: 'PD',
  BUNDESLIGA: 'BL1',
  SERIE_A: 'SA',
  LIGUE_1: 'FL1',
} as const;

export type LeagueCode = (typeof LEAGUE_CODES)[keyof typeof LEAGUE_CODES];

// API response types
export interface ApiPlayer {
  id: number;
  firstName: string | null;
  lastName: string | null;
  name: string;
  position: 'Goalkeeper' | 'Defence' | 'Midfield' | 'Offence' | null;
  dateOfBirth: string | null;
  nationality: string;
  shirtNumber: number | null;
  marketValue: number | null;
  contract?: {
    start: string | null;
    until: string | null;
  };
}

export interface ApiTeam {
  id: number;
  name: string;
  shortName: string;
  tla: string;
  crest: string;
  address: string;
  website: string;
  founded: number;
  clubColors: string;
  venue: string;
  squad: ApiPlayer[];
}

export interface ApiCompetitionTeams {
  competition: {
    id: number;
    name: string;
    code: string;
  };
  teams: Array<{
    id: number;
    name: string;
    shortName: string;
    tla: string;
    crest: string;
  }>;
}

let lastRequestTime = 0;

/**
 * Wait for rate limit before making a request.
 */
async function waitForRateLimit(): Promise<void> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < RATE_LIMIT_DELAY_MS) {
    const waitTime = RATE_LIMIT_DELAY_MS - timeSinceLastRequest;
    console.log(`  Rate limiting: waiting ${(waitTime / 1000).toFixed(1)}s...`);
    await new Promise((resolve) => setTimeout(resolve, waitTime));
  }

  lastRequestTime = Date.now();
}

/**
 * Make an authenticated request to the football-data.org API.
 */
async function fetchApi<T>(endpoint: string, apiKey: string): Promise<T> {
  await waitForRateLimit();

  const url = `${API_BASE_URL}${endpoint}`;
  console.log(`  Fetching: ${url}`);

  const response = await fetch(url, {
    headers: {
      'X-Auth-Token': apiKey,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API error ${response.status}: ${error}`);
  }

  return response.json() as Promise<T>;
}

/**
 * Get all teams in a competition.
 */
export async function getCompetitionTeams(
  leagueCode: LeagueCode,
  apiKey: string
): Promise<ApiCompetitionTeams> {
  return fetchApi<ApiCompetitionTeams>(`/competitions/${leagueCode}/teams`, apiKey);
}

/**
 * Get a team with full squad.
 */
export async function getTeamWithSquad(teamId: number, apiKey: string): Promise<ApiTeam> {
  return fetchApi<ApiTeam>(`/teams/${teamId}`, apiKey);
}

/**
 * Get league name from code.
 */
export function getLeagueName(code: LeagueCode): string {
  const names: Record<LeagueCode, string> = {
    PL: 'PREMIER_LEAGUE',
    PD: 'LA_LIGA',
    BL1: 'BUNDESLIGA',
    SA: 'SERIE_A',
    FL1: 'LIGUE_1',
  };
  return names[code];
}
