#!/usr/bin/env npx tsx
/**
 * Fetch players from football-data.org and update the players CSV.
 *
 * Usage:
 *   FOOTBALL_DATA_API_KEY=your_key npx tsx scripts/fetch-players.ts
 *
 * Get your free API key at: https://www.football-data.org/client/register
 */
import "dotenv/config";
import * as fs from 'fs';
import * as path from 'path';
import {
  LEAGUE_CODES,
  getCompetitionTeams,
  getTeamWithSquad,
  getLeagueName,
  type ApiPlayer,
  type LeagueCode,
} from './lib/football-data-client';
import { getCountryCode } from './lib/country-codes';

// CSV output path
const CSV_PATH = path.join(process.cwd(), 'prisma/data/players.csv');

// Position mapping from API to our format
const POSITION_MAP: Record<string, { position: string; group: string }> = {
  Goalkeeper: { position: 'Goalkeeper', group: 'GOALKEEPER' },
  Defence: { position: 'Defender', group: 'DEFENDER' },
  Midfield: { position: 'Midfielder', group: 'MIDFIELDER' },
  Offence: { position: 'Forward', group: 'FORWARD' },
};

// No default values - unknown data is stored as null

interface PlayerRow {
  name: string;
  slug: string;
  nationality: string;
  countryCode: string;
  club: string;
  league: string;
  position: string;
  positionGroup: string;
  birthDate: string;
  heightCm: number | null;
  preferredFoot: string | null;
  active: boolean;
  popularity: number;
  imageUrl: string;
  clubLogoUrl: string;
}

/**
 * Generate URL-friendly slug from name.
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Calculate popularity score from market value (1-100 scale).
 */
function calculatePopularity(marketValue: number | null, maxValue: number): number {
  if (!marketValue || marketValue <= 0) return 50; // Default for unknown
  // Logarithmic scale to spread values
  const normalized = Math.log10(marketValue + 1) / Math.log10(maxValue + 1);
  return Math.min(99, Math.max(1, Math.round(normalized * 98) + 1));
}

/**
 * Transform API player to our CSV format.
 */
function transformPlayer(
  player: ApiPlayer,
  club: string,
  league: string,
  clubLogoUrl: string,
  maxMarketValue: number
): PlayerRow | null {
  // Skip players without essential data
  if (!player.name || !player.dateOfBirth || !player.nationality) {
    return null;
  }

  const positionInfo = player.position ? POSITION_MAP[player.position] : null;
  if (!positionInfo) {
    // Skip players without a valid position (likely staff or youth)
    return null;
  }

  return {
    name: player.name,
    slug: generateSlug(player.name),
    nationality: player.nationality,
    countryCode: getCountryCode(player.nationality),
    club,
    league,
    position: positionInfo.position,
    positionGroup: positionInfo.group,
    birthDate: player.dateOfBirth,
    heightCm: null, // Not provided by football-data.org
    preferredFoot: null, // Not provided by football-data.org
    active: true,
    popularity: calculatePopularity(player.marketValue, maxMarketValue),
    imageUrl: '',
    clubLogoUrl,
  };
}

/**
 * Escape a CSV field - quote if contains comma, quote, or newline.
 */
function escapeCSV(value: string | number | boolean | null): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Convert player rows to CSV string.
 */
function toCSV(players: PlayerRow[]): string {
  const headers = [
    'name',
    'slug',
    'nationality',
    'countryCode',
    'club',
    'league',
    'position',
    'positionGroup',
    'birthDate',
    'heightCm',
    'preferredFoot',
    'active',
    'popularity',
    'imageUrl',
    'clubLogoUrl',
  ];

  const rows = players.map((p) =>
    [
      escapeCSV(p.name),
      escapeCSV(p.slug),
      escapeCSV(p.nationality),
      escapeCSV(p.countryCode),
      escapeCSV(p.club),
      escapeCSV(p.league),
      escapeCSV(p.position),
      escapeCSV(p.positionGroup),
      escapeCSV(p.birthDate),
      escapeCSV(p.heightCm),
      escapeCSV(p.preferredFoot),
      escapeCSV(p.active),
      escapeCSV(p.popularity),
      escapeCSV(p.imageUrl),
      escapeCSV(p.clubLogoUrl),
    ].join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Main function to fetch all players.
 */
async function main() {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;

  if (!apiKey) {
    console.error(process.env.FOOTBALL_DATA_API_KEY);
    console.error('Error: FOOTBALL_DATA_API_KEY environment variable is required');
    console.error('Get your free API key at: https://www.football-data.org/client/register');
    process.exit(1);
  }

  console.log('🏈 Fetching Big Five league players from football-data.org\n');
  console.log('Note: This will take ~10-15 minutes due to API rate limiting (10 req/min)\n');

  const allPlayers: PlayerRow[] = [];
  const slugs = new Set<string>();
  let maxMarketValue = 200_000_000; // €200M as initial max

  // First pass: collect all teams and find max market value
  const teamsByLeague: Map<LeagueCode, Array<{ id: number; name: string; crest: string }>> =
    new Map();

  for (const [leagueName, leagueCode] of Object.entries(LEAGUE_CODES)) {
    console.log(`\n📋 Fetching ${leagueName} teams...`);

    try {
      const response = await getCompetitionTeams(leagueCode as LeagueCode, apiKey);
      teamsByLeague.set(
        leagueCode as LeagueCode,
        response.teams.map((t) => ({ id: t.id, name: t.name, crest: t.crest }))
      );
      console.log(`   Found ${response.teams.length} teams`);
    } catch (error) {
      console.error(`   Error fetching ${leagueName}:`, error);
    }
  }

  // Second pass: fetch each team's squad
  for (const [leagueCode, teams] of teamsByLeague) {
    const leagueName = getLeagueName(leagueCode);
    console.log(`\n⚽ Processing ${leagueName} squads...`);

    for (const team of teams) {
      console.log(`\n   ${team.name}:`);

      try {
        const teamData = await getTeamWithSquad(team.id, apiKey);

        // Find max market value for popularity calculation
        for (const player of teamData.squad || []) {
          if (player.marketValue && player.marketValue > maxMarketValue) {
            maxMarketValue = player.marketValue;
          }
        }

        let addedCount = 0;
        for (const player of teamData.squad || []) {
          const row = transformPlayer(
            player,
            team.name,
            leagueName,
            team.crest,
            maxMarketValue
          );

          if (row) {
            // Handle duplicate slugs
            let slug = row.slug;
            let suffix = 1;
            while (slugs.has(slug)) {
              slug = `${row.slug}-${suffix}`;
              suffix++;
            }
            row.slug = slug;
            slugs.add(slug);

            allPlayers.push(row);
            addedCount++;
          }
        }

        console.log(`   ✓ Added ${addedCount} players`);
      } catch (error) {
        console.error(`   ✗ Error fetching ${team.name}:`, error);
      }
    }
  }

  // Sort by popularity (most popular first)
  allPlayers.sort((a, b) => b.popularity - a.popularity);

  // Write CSV
  console.log(`\n📝 Writing ${allPlayers.length} players to ${CSV_PATH}...`);
  const csv = toCSV(allPlayers);
  fs.writeFileSync(CSV_PATH, csv, 'utf-8');

  console.log('\n✅ Done!');
  console.log(`\nNext steps:`);
  console.log(`  1. Review the CSV: ${CSV_PATH}`);
  console.log(`  2. Run: npm run db:seed`);

  // Summary by league
  console.log('\n📊 Summary by league:');
  const byLeague = allPlayers.reduce(
    (acc, p) => {
      acc[p.league] = (acc[p.league] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  for (const [league, count] of Object.entries(byLeague)) {
    console.log(`   ${league}: ${count} players`);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
