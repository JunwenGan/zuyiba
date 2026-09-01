import 'dotenv/config';
import { parse } from 'csv-parse/sync';
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../lib/generated/prisma/client';
import { validatePlayerCsv, type PlayerCsvRow } from '../lib/validation/player';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Starting database seed...\n');

  // Read CSV file
  const csvPath = path.join(__dirname, 'data', 'players.csv');

  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found at ${csvPath}`);
  }

  const csvContent = fs.readFileSync(csvPath, 'utf-8');

  // Parse CSV
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, unknown>[];

  console.log(`Found ${records.length} player records in CSV\n`);

  // Validate CSV data
  const validationResult = validatePlayerCsv(records);

  if (!validationResult.success) {
    console.error('Validation errors:');
    validationResult.errors.forEach((error) => console.error(`  - ${error}`));
    throw new Error('CSV validation failed');
  }

  const players = validationResult.data;
  console.log(`Validated ${players.length} players successfully\n`);

  // Upsert players (idempotent seeding)
  let created = 0;
  let updated = 0;

  for (const player of players) {
    const playerData = transformPlayerData(player);

    const existing = await prisma.player.findUnique({
      where: { slug: player.slug },
    });

    if (existing) {
      await prisma.player.update({
        where: { slug: player.slug },
        data: playerData,
      });
      updated++;
    } else {
      await prisma.player.create({
        data: playerData,
      });
      created++;
    }
  }

  console.log(`Seed completed:`);
  console.log(`  - Created: ${created} players`);
  console.log(`  - Updated: ${updated} players`);
  console.log(`  - Total: ${players.length} players\n`);

  // Verify data
  const playerCount = await prisma.player.count();
  const activeCount = await prisma.player.count({ where: { active: true } });

  console.log('Database verification:');
  console.log(`  - Total players: ${playerCount}`);
  console.log(`  - Active players: ${activeCount}`);

  // Show league distribution
  const leagueDistribution = await prisma.player.groupBy({
    by: ['league'],
    _count: { league: true },
  });

  console.log('\nPlayers by league:');
  for (const item of leagueDistribution) {
    console.log(`  - ${item.league}: ${item._count.league}`);
  }
}

function transformPlayerData(row: PlayerCsvRow) {
  return {
    name: row.name,
    slug: row.slug,
    nationality: row.nationality,
    countryCode: row.countryCode,
    club: row.club,
    league: row.league,
    position: row.position,
    positionGroup: row.positionGroup,
    birthDate: new Date(row.birthDate),
    heightCm: row.heightCm, // Already nullable from validation
    preferredFoot: row.preferredFoot, // Already nullable from validation
    active: row.active,
    popularity: row.popularity,
    imageUrl: row.imageUrl || null,
    clubLogoUrl: row.clubLogoUrl || null,
  };
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
