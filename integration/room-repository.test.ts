import 'dotenv/config';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { Client } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../lib/generated/prisma/client';
import { createRoomRepository } from '../features/multiplayer/room-repository';
import { NextRequest } from 'next/server';
import { createMultiplayerHttp } from '../features/multiplayer/http';
import { GUEST_COOKIE } from '../features/multiplayer/guest-session';

// Never mutate the database from .env: create and own a new local database.
const source = new URL(process.env.DATABASE_URL || '');
if (!['localhost', '127.0.0.1', '[::1]'].includes(source.hostname)) {
  throw new Error('Integration tests require local PostgreSQL.');
}
const databaseName = `zuyiba_integration_${randomUUID().replaceAll('-', '')}`;
const adminUrl = new URL(source);
adminUrl.pathname = '/postgres';
const testUrl = new URL(source);
testUrl.pathname = `/${databaseName}`;
testUrl.search = '';
const admin = new Client({ connectionString: adminUrl.href, connectionTimeoutMillis: 5000 });
const makeClient = () =>
  new PrismaClient({ adapter: new PrismaPg({ connectionString: testUrl.href }) });
const db = makeClient();
const rooms = createRoomRepository(db);
const http = createMultiplayerHttp(db, 'https://zuyiba.test');
let created = false;

before(async () => {
  await admin.connect();
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  created = true;
  execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: testUrl.href },
    stdio: 'inherit',
  });
});

after(async () => {
  try {
    await db.$disconnect();
  } finally {
    try {
      if (created) {
        await admin.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
        console.log(`Removed temporary database: ${databaseName}`);
      }
    } finally {
      await admin.end();
    }
  }
});

test('room and readiness survive loading through another database client', async () => {
  const room = await rooms.create('host');
  await rooms.join(room.id, 'guest');
  await rooms.ready(room.id, 'guest', true);
  const otherDb = makeClient();
  try {
    const loaded = await createRoomRepository(otherDb).find(room.id);
    assert.equal(loaded?.hostId, 'host');
    assert.equal(loaded?.status, 'WAITING');
    assert.equal(loaded?.participants.length, 2);
    assert.equal(loaded?.participants.find((p) => p.id === 'guest')?.isReady, true);
  } finally {
    await otherDb.$disconnect();
  }
});

test('two simultaneous guests cannot both take the final seat', async () => {
  const room = await rooms.create('host');
  const results = await Promise.allSettled([
    rooms.join(room.id, 'guest-a'),
    rooms.join(room.id, 'guest-b'),
  ]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  const rejected = results.find((result) => result.status === 'rejected');
  assert.match(String(rejected?.reason), /room is full/);
  assert.equal((await rooms.find(room.id))?.participants.length, 2);
});

test('simultaneous duplicate joins are idempotent', async () => {
  const room = await rooms.create('host');
  await Promise.all([rooms.join(room.id, 'guest'), rooms.join(room.id, 'guest')]);
  await rooms.ready(room.id, 'guest', true);
  const rejoined = await rooms.join(room.id, 'guest');
  assert.equal(rejoined.participants.length, 2);
  assert.equal(rejoined.participants.find((p) => p.id === 'guest')?.isReady, true);
});

test('concurrent readiness updates preserve both participants; start persists', async () => {
  const room = await rooms.create('host');
  await rooms.join(room.id, 'guest');
  await Promise.all([rooms.ready(room.id, 'host', true), rooms.ready(room.id, 'guest', true)]);
  await assert.rejects(rooms.start(room.id, 'guest'), /Only the host/);
  await rooms.start(room.id, 'host');
  assert.equal((await rooms.find(room.id))?.status, 'PLAYING');
  await assert.rejects(rooms.ready(room.id, 'guest', false), /already started/);
  await assert.rejects(rooms.start(room.id, 'host'), /already started/);
});

test('invalid changes do not modify saved state', async () => {
  const room = await rooms.create('host');
  await assert.rejects(rooms.ready(room.id, 'outsider', true), /not a participant/);
  await assert.rejects(rooms.start(room.id, 'host'), /Two ready participants/);
  assert.deepEqual(await rooms.find(room.id), room);
  assert.equal(await rooms.find('missing'), null);
  await assert.rejects(rooms.join('missing', 'guest'), /Room not found/);
});

function request(
  cookie = '',
  input: unknown = {},
  method = 'POST',
  origin = 'https://zuyiba.test'
) {
  return new NextRequest('https://zuyiba.test/api/rooms', {
    method,
    headers: { origin, cookie, 'content-type': 'application/json' },
    ...(method === 'GET' ? {} : { body: JSON.stringify(input) }),
  });
}

async function guest() {
  const response = await http.session(request());
  assert.equal(response.status, 201);
  const { data } = await response.json();
  const token = response.cookies.get(GUEST_COOKIE)!.value;
  return { id: data.participantId as string, token, cookie: `${GUEST_COOKIE}=${token}`, response };
}

test('guest token is protected, hashed at rest, and reused without changing identity', async () => {
  const person = await guest();
  const setCookie = person.response.headers.get('set-cookie')!;
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /Secure/i);
  assert.match(setCookie, /SameSite=lax/i);
  assert.equal(person.response.headers.get('cache-control'), 'no-store');
  const stored = await db.guestSession.findUniqueOrThrow({ where: { id: person.id } });
  assert.notEqual(stored.tokenHash, person.token);
  const again = await http.session(request(person.cookie));
  assert.equal(again.status, 200);
  assert.equal((await again.json()).data.participantId, person.id);
  assert.equal(again.headers.get('set-cookie'), null);
});

test('two authenticated guests create, join, ready and reload a room', async () => {
  const host = await guest();
  const friend = await guest();
  const createdRoom = await http.create(request(host.cookie));
  assert.equal(createdRoom.status, 201);
  const room = (await createdRoom.json()).data;
  assert.equal(room.hostId, host.id);
  assert.equal((await http.join(request(friend.cookie), room.id)).status, 200);
  assert.equal((await http.ready(request(friend.cookie, { isReady: true }), room.id)).status, 200);
  const reloaded = await http.read(request(host.cookie, {}, 'GET'), room.id);
  assert.equal(reloaded.status, 200);
  const saved = (await reloaded.json()).data;
  assert.equal(saved.participants.find((p: { id: string }) => p.id === friend.id).isReady, true);
  assert.equal(saved.participants.find((p: { id: string }) => p.id === host.id).isReady, false);
  assert.equal((await http.join(request(friend.cookie), room.id)).status, 200);
  const third = await guest();
  assert.equal((await http.join(request(third.cookie), room.id)).status, 409);
});

test('missing, forged, expired cookies and public participant IDs cannot authenticate', async () => {
  const person = await guest();
  for (const cookie of ['', `${GUEST_COOKIE}=${'0'.repeat(64)}`, `${GUEST_COOKIE}=${person.id}`]) {
    assert.equal((await http.create(request(cookie))).status, 401);
  }
  await db.guestSession.update({ where: { id: person.id }, data: { expiresAt: new Date(0) } });
  assert.equal((await http.create(request(person.cookie))).status, 401);
  const renewed = await http.session(request(person.cookie));
  assert.equal(renewed.status, 201);
  assert.notEqual((await renewed.json()).data.participantId, person.id);
});

test('outsiders cannot read private room state or change another participant readiness', async () => {
  const host = await guest();
  const outsider = await guest();
  const room = (await (await http.create(request(host.cookie))).json()).data;
  assert.equal((await http.read(request(outsider.cookie, {}, 'GET'), room.id)).status, 404);
  assert.equal(
    (await http.ready(request(outsider.cookie, { isReady: true }), room.id)).status,
    403
  );
  assert.equal(
    (await http.ready(request(outsider.cookie, { isReady: true, participantId: host.id }), room.id))
      .status,
    400
  );
  assert.equal((await http.create(request(outsider.cookie, { hostId: host.id }))).status, 400);
  assert.equal((await rooms.find(room.id))?.participants[0].isReady, false);
});

test('cross-origin writes and malformed bodies are rejected before creating sessions', async () => {
  const count = await db.guestSession.count();
  for (const origin of ['https://evil.test', 'null', '']) {
    assert.equal((await http.session(request('', {}, 'POST', origin))).status, 403);
  }
  for (const input of [null, [], { participantId: 'forged' }, { large: 'x'.repeat(1100) }]) {
    assert.equal((await http.session(request('', input))).status, 400);
  }
  for (const [contentType, raw] of [
    ['application/json', '{'],
    ['text/plain', '{}'],
  ]) {
    const response = await http.session(
      new NextRequest('https://zuyiba.test/api/multiplayer/session', {
        method: 'POST',
        headers: { origin: 'https://zuyiba.test', 'content-type': contentType },
        body: raw,
      })
    );
    assert.equal(response.status, 400);
  }
  assert.equal(await db.guestSession.count(), count);
});

test('readiness requires a boolean and missing rooms return 404', async () => {
  const host = await guest();
  const room = (await (await http.create(request(host.cookie))).json()).data;
  assert.equal((await http.ready(request(host.cookie, { isReady: 'true' }), room.id)).status, 400);
  assert.equal((await http.join(request(host.cookie), 'missing')).status, 404);
  assert.equal((await http.read(request(host.cookie, {}, 'GET'), 'missing')).status, 404);
});

test('local origin check preserves 127.0.0.1 despite NextURL normalization', async () => {
  const localHttp = createMultiplayerHttp(db);
  const makeRequest = (origin: string) =>
    new NextRequest('http://127.0.0.1:3100/api/multiplayer/session', {
      method: 'POST',
      headers: { host: '127.0.0.1:3100', origin, 'content-type': 'application/json' },
      body: '{}',
    });
  const valid = await localHttp.session(makeRequest('http://127.0.0.1:3100'));
  assert.equal(valid.status, 201);
  assert.doesNotMatch(valid.headers.get('set-cookie')!, /; Secure/i);
  assert.equal((await localHttp.session(makeRequest('http://localhost:3100'))).status, 403);
});
