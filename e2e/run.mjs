import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { Client } from 'pg';

// Never seed or reset the developer's database. Own one new database per run.
const source = new URL(process.env.DATABASE_URL || '');
if (!['localhost', '127.0.0.1', '[::1]'].includes(source.hostname)) {
  throw new Error('E2E requires local PostgreSQL; remote databases are not allowed.');
}
const name = `zuyiba_e2e_${randomUUID().replaceAll('-', '')}`;
const adminUrl = new URL(source);
adminUrl.pathname = '/postgres';
const testUrl = new URL(source);
testUrl.pathname = `/${name}`;
testUrl.search = '';
const env = { ...process.env, DATABASE_URL: testUrl.href, ZUYIBA_E2E: '1' };
const admin = new Client({ connectionString: adminUrl.href, connectionTimeoutMillis: 5000 });
let created = false;

function run(file, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [file, ...args], { env, stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${file} exited with ${code}`))
    );
  });
}

try {
  await admin.connect();
  await admin.query(`CREATE DATABASE "${name}"`);
  created = true;
  console.log(`Created isolated test database: ${name}`);
  await run('node_modules/prisma/build/index.js', ['db', 'push']);
  const db = new Client({ connectionString: testUrl.href });
  await db.connect();
  try {
    for (let i = 0; i < 9; i++) {
      await db.query(
        `INSERT INTO "Player"
        (id, name, slug, nationality, "countryCode", club, league, position, "positionGroup", "birthDate", "heightCm", "preferredFoot", "updatedAt")
        VALUES ($1,$2,$1,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())`,
        [
          `e2e-player-${i}`,
          i === 0 ? 'Alpha Answer' : `Bravo Guess ${i}`,
          i === 0 ? 'Spain' : 'Portugal',
          i === 0 ? 'ES' : 'PT',
          i === 0 ? 'FC Barcelona' : 'Fixture Club With A Very Long Name',
          i === 0 ? 'LA_LIGA' : 'PREMIER_LEAGUE',
          i === 0 ? 'Forward' : 'Defender',
          i === 0 ? 'FORWARD' : 'DEFENDER',
          i === 0 ? '2000-01-01' : '2004-01-01',
          180,
          'RIGHT',
        ]
      );
    }
  } finally {
    await db.end();
  }
  await run('node_modules/@playwright/test/cli.js', ['test', ...process.argv.slice(2)]);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (created) {
    // Only this run's generated name is ever eligible for cleanup.
    await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
    console.log(`Removed temporary test database: ${name}`);
  }
  await admin.end();
}
