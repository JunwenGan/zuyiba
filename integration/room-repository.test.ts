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
import { createMatchRepository } from '../features/multiplayer/match-repository';
import { createServer } from 'node:http';
import { io as connectSocket } from 'socket.io-client';
import { attachRoomSockets } from '../features/multiplayer/socket-server';
import { createMatchLifecycle, RECONNECT_GRACE_MS } from '../features/multiplayer/match-lifecycle';

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
const matches = createMatchRepository(db);
const lifecycle = createMatchLifecycle(db);
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
  await db.player.createMany({
    data: ['match-player-a', 'match-player-b', 'inactive-player'].map((id) => ({
      id,
      name: id,
      slug: id,
      nationality: 'Spain',
      countryCode: 'ES',
      club: 'FC Barcelona',
      league: 'LA_LIGA',
      position: 'Forward',
      positionGroup: 'FORWARD',
      birthDate: new Date('2000-01-01'),
      heightCm: 180,
      preferredFoot: 'RIGHT',
      active: id !== 'inactive-player',
    })),
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

async function playingRoom() {
  const room = await rooms.create('host');
  await rooms.join(room.id, 'guest');
  await rooms.ready(room.id, 'host', true);
  await rooms.ready(room.id, 'guest', true);
  await rooms.start(room.id, 'host');
  const stored = await db.matchRoom.findUniqueOrThrow({ where: { id: room.id } });
  const answerId = stored.answerPlayerId!;
  const wrongId = answerId === 'match-player-a' ? 'match-player-b' : 'match-player-a';
  return { roomId: room.id, answerId, wrongId };
}

async function wrongPlayers() {
  const template = await db.player.findUniqueOrThrow({ where: { id: 'match-player-a' } });
  const ids = Array.from({ length: 9 }, (_, i) => `limit-wrong-${i}`);
  await db.player.createMany({
    data: ids.map((id) => ({ ...template, id, slug: id, name: id, club: 'Test club' })),
    skipDuplicates: true,
  });
  return ids;
}

test('eight guesses per player: ninth rejected, retries safe, both exhausted draw survives reload', async () => {
  const ids = await wrongPlayers();
  const { roomId, answerId } = await playingRoom();
  for (const id of ids.slice(0, 8)) await matches.guess(roomId, 'host', id);
  const waiting = await matches.read(roomId, 'host');
  assert.equal(waiting.status, 'PLAYING');
  assert.equal(waiting.answer, null);
  assert.equal(waiting.guesses.length, 8);
  await assert.rejects(matches.guess(roomId, 'host', answerId), /used all 8/);
  assert.equal((await matches.guess(roomId, 'host', ids[0])).guesses.length, 8);
  for (const id of ids.slice(0, 8)) await matches.guess(roomId, 'guest', id);
  const draw = await matches.read(roomId, 'host');
  assert.equal(draw.status, 'FINISHED');
  assert.equal(draw.winnerId, null);
  assert.ok(draw.completedAt);
  assert.equal(draw.answer?.id, answerId);
  assert.equal(draw.opponentGuesses.length, 8);
  await assert.rejects(matches.guess(roomId, 'guest', answerId), /not playing/);
});

test('correct eighth guess wins even after opponent exhausts their attempts', async () => {
  const ids = await wrongPlayers();
  const { roomId, answerId } = await playingRoom();
  for (const id of ids.slice(0, 8)) await matches.guess(roomId, 'host', id);
  for (const id of ids.slice(0, 7)) await matches.guess(roomId, 'guest', id);
  const won = await matches.guess(roomId, 'guest', answerId);
  assert.equal(won.status, 'FINISHED');
  assert.equal(won.winnerId, 'guest');
  assert.equal(won.guesses.length, 8);
});

test('concurrent guesses cannot exceed eight, concurrent final misses produce a draw', async () => {
  const ids = await wrongPlayers();
  const { roomId } = await playingRoom();
  for (const participant of ['host', 'guest']) {
    for (const id of ids.slice(0, 7)) await matches.guess(roomId, participant, id);
  }
  const results = await Promise.allSettled([
    matches.guess(roomId, 'host', ids[7]),
    matches.guess(roomId, 'host', ids[8]),
    matches.guess(roomId, 'guest', ids[7]),
  ]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 2);
  const final = await matches.read(roomId, 'host');
  assert.equal(final.guesses.length, 8);
  assert.equal(final.opponentGuesses.length, 8);
  assert.equal(final.status, 'FINISHED');
  assert.equal(final.winnerId, null);
});

test('leaving forfeits, cannot overwrite a result, and concurrent restarts share a fresh lobby', async () => {
  const { roomId, answerId, wrongId } = await playingRoom();
  await matches.guess(roomId, 'host', wrongId);
  await assert.rejects(lifecycle.restart(roomId, 'host'), /Finish the match/);
  await assert.rejects(lifecycle.leave(roomId, 'outsider'), /not a participant/);
  await lifecycle.leave(roomId, 'host');
  await lifecycle.leave(roomId, 'guest');
  const ended = await matches.read(roomId, 'host');
  assert.equal(ended.winnerId, 'guest');
  assert.equal(ended.finishReason, 'FORFEIT');
  assert.equal(ended.answer?.id, answerId);
  await assert.rejects(matches.guess(roomId, 'guest', answerId), /not playing/);
  await assert.rejects(lifecycle.restart(roomId, 'outsider'), /not a participant/);
  const [a, b] = await Promise.all([
    lifecycle.restart(roomId, 'host'),
    lifecycle.restart(roomId, 'guest'),
  ]);
  assert.equal(a.roomId, b.roomId);
  assert.notEqual(a.roomId, roomId);
  const next = await matches.read(a.roomId, 'host');
  assert.equal(next.status, 'WAITING');
  assert.equal(next.answer, null);
  assert.equal(next.guesses.length, 0);
  assert.equal(next.opponentGuesses.length, 0);
  assert.ok(next.participants.every((p) => !p.isReady));
  assert.equal((await matches.read(roomId, 'host')).guesses.length, 1);
});

test('disconnect grace supports reconnect, forfeit, abandonment and persistent timestamps', async () => {
  const { roomId } = await playingRoom();
  const start = new Date();
  await lifecycle.reconcile(roomId, new Set(['host', 'guest']), start);
  assert.equal(
    await lifecycle.reconcile(roomId, new Set(['host']), new Date(+start + RECONNECT_GRACE_MS - 1)),
    false
  );
  // Reconnected before the deadline: refresh both leases.
  await lifecycle.reconcile(
    roomId,
    new Set(['host', 'guest']),
    new Date(+start + RECONNECT_GRACE_MS - 1)
  );
  assert.equal(
    await lifecycle.reconcile(roomId, new Set(['host']), new Date(+start + RECONNECT_GRACE_MS)),
    false
  );
  assert.equal(
    await lifecycle.reconcile(roomId, new Set(['host']), new Date(+start + 2 * RECONNECT_GRACE_MS)),
    true
  );
  const ended = await matches.read(roomId, 'guest');
  assert.equal(ended.finishReason, 'DISCONNECT');
  assert.equal(ended.winnerId, 'host');
  assert.equal(
    await lifecycle.reconcile(roomId, new Set(), new Date(+start + 3 * RECONNECT_GRACE_MS)),
    false
  );
  const abandoned = await playingRoom();
  await lifecycle.reconcile(abandoned.roomId, new Set(['host', 'guest']), start);
  // A new repository instance recovers deadlines using only saved database state.
  await createMatchLifecycle(db).reconcile(
    abandoned.roomId,
    new Set(),
    new Date(+start + RECONNECT_GRACE_MS)
  );
  const result = await matches.read(abandoned.roomId, 'host');
  assert.equal(result.finishReason, 'ABANDONED');
  assert.equal(result.winnerId, null);
  assert.equal(result.status, 'FINISHED');
});

test('correct guess racing a leave commits one stable outcome', async () => {
  const { roomId, answerId } = await playingRoom();
  await Promise.allSettled([
    matches.guess(roomId, 'host', answerId),
    lifecycle.leave(roomId, 'host'),
  ]);
  const result = await matches.read(roomId, 'host');
  assert.equal(result.status, 'FINISHED');
  assert.ok(result.finishReason === 'CORRECT' || result.finishReason === 'FORFEIT');
  assert.equal(result.winnerId, result.finishReason === 'CORRECT' ? 'host' : 'guest');
});

test('leave and restart APIs reject missing identity, outsiders and malformed input', async () => {
  const host = await guest();
  const outsider = await guest();
  const room = await rooms.create(host.id);
  for (const action of [http.leave, http.restart]) {
    assert.equal((await action(request(''), room.id)).status, 401);
    assert.equal((await action(request(outsider.cookie), room.id)).status, 403);
    assert.equal((await action(request(host.cookie, { winnerId: host.id }), room.id)).status, 400);
    assert.equal((await action(request(host.cookie), room.id)).status, 409);
  }
});

test('answer stays hidden; identical attributes do not win; feedback survives reload privately', async () => {
  const { roomId, answerId, wrongId } = await playingRoom();
  const initial = await matches.read(roomId, 'host');
  assert.equal(initial.answer, null);
  assert.equal(JSON.stringify(initial).includes(answerId), false);
  assert.equal('answerPlayerId' in initial, false);
  const wrong = await matches.guess(roomId, 'host', wrongId);
  assert.equal(wrong.status, 'PLAYING');
  assert.equal(wrong.winnerId, null);
  assert.equal(wrong.guesses[0].comparison.club, 'correct');
  assert.equal(wrong.guesses[0].comparison.age.result, 'correct');
  assert.deepEqual((await matches.read(roomId, 'host')).guesses, wrong.guesses);
  assert.deepEqual((await matches.read(roomId, 'guest')).guesses, []);
  assert.equal((await matches.read(roomId, 'guest')).answer, null);
  const opponentView = await matches.read(roomId, 'guest');
  assert.deepEqual(opponentView.opponentGuesses, [
    {
      guessNumber: 1,
      results: {
        nationality: 'correct',
        club: 'correct',
        league: 'correct',
        position: 'correct',
        age: 'correct',
      },
    },
  ]);
  assert.equal(JSON.stringify(opponentView).includes(wrongId), false);
  assert.deepEqual(wrong.opponentGuesses, []);
  // Both players receive only the other person's result grid, ordered per guess.
  const won = await matches.guess(roomId, 'guest', answerId);
  const hostView = await matches.read(roomId, 'host');
  assert.equal(hostView.opponentGuesses.length, 1);
  assert.deepEqual(Object.keys(hostView.opponentGuesses[0]).sort(), ['guessNumber', 'results']);
  assert.deepEqual(won.opponentGuesses, opponentView.opponentGuesses);
});

test('simultaneous correct guesses record exactly one winner and reject new guesses after finish', async () => {
  const { roomId, answerId, wrongId } = await playingRoom();
  const results = await Promise.allSettled([
    matches.guess(roomId, 'host', answerId),
    matches.guess(roomId, 'guest', answerId),
  ]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(results.filter((r) => r.status === 'rejected').length, 1);
  const result = await matches.read(roomId, 'host');
  assert.equal(result.status, 'FINISHED');
  assert.ok(['host', 'guest'].includes(result.winnerId!));
  assert.equal(result.answer?.id, answerId);
  assert.ok(result.completedAt);
  assert.equal(await db.matchGuess.count({ where: { roomId } }), 1);
  assert.equal((await matches.read(roomId, 'guest')).winnerId, result.winnerId);
  await assert.rejects(matches.guess(roomId, 'host', wrongId), /not playing/);
  // A lost response to the winning request can be retried without a second win.
  assert.equal((await matches.guess(roomId, result.winnerId!, answerId)).winnerId, result.winnerId);
  await assert.rejects(rooms.start(roomId, 'host'), /already started/);
});

test('simultaneous duplicate guesses create one attempt; each participant has their own history', async () => {
  const { roomId, wrongId } = await playingRoom();
  await Promise.all([
    matches.guess(roomId, 'host', wrongId),
    matches.guess(roomId, 'host', wrongId),
  ]);
  const host = await matches.read(roomId, 'host');
  assert.equal(host.guesses.length, 1);
  assert.equal(host.guesses[0].guessNumber, 1);
  assert.equal((await matches.read(roomId, 'guest')).opponentGuesses.length, 1);
  assert.equal((await matches.guess(roomId, 'guest', wrongId)).guesses[0].guessNumber, 1);
});

test('waiting rooms, outsiders, missing and inactive players cannot submit guesses', async () => {
  const waiting = await rooms.create('host');
  await assert.rejects(matches.guess(waiting.id, 'host', 'match-player-a'), /not playing/);
  const { roomId, answerId } = await playingRoom();
  await assert.rejects(matches.guess(roomId, 'outsider', answerId), /not a participant/);
  await assert.rejects(matches.read(roomId, 'outsider'), /Room not found/);
  await assert.rejects(matches.guess(roomId, 'host', 'missing'), /Player not found/);
  await assert.rejects(matches.guess(roomId, 'host', 'inactive-player'), /Player not found/);
  assert.equal(await db.matchGuess.count({ where: { roomId } }), 0);
});

test('starting without eligible players rolls back and leaves the room waiting', async () => {
  const room = await rooms.create('host');
  await rooms.join(room.id, 'guest');
  await rooms.ready(room.id, 'host', true);
  await rooms.ready(room.id, 'guest', true);
  await db.player.updateMany({
    where: { id: { in: ['match-player-a', 'match-player-b'] } },
    data: { active: false },
  });
  try {
    await assert.rejects(rooms.start(room.id, 'host'), /No eligible players/);
    const saved = await db.matchRoom.findUniqueOrThrow({ where: { id: room.id } });
    assert.equal(saved.status, 'WAITING');
    assert.equal(saved.answerPlayerId, null);
    assert.equal(saved.startedAt, null);
  } finally {
    await db.player.updateMany({
      where: { id: { in: ['match-player-a', 'match-player-b'] } },
      data: { active: true },
    });
  }
});

test('start/guess APIs enforce identity, readiness and strict input', async () => {
  const host = await guest();
  const friend = await guest();
  const room = (await (await http.create(request(host.cookie))).json()).data;
  assert.equal((await http.start(request(), room.id)).status, 401);
  assert.equal((await http.start(request(host.cookie), room.id)).status, 409);
  await http.join(request(friend.cookie), room.id);
  await http.ready(request(host.cookie, { isReady: true }), room.id);
  await http.ready(request(friend.cookie, { isReady: true }), room.id);
  assert.equal((await http.start(request(friend.cookie), room.id)).status, 403);
  assert.equal(
    (await http.start(request(host.cookie, { answerPlayerId: 'match-player-a' }), room.id)).status,
    400
  );
  const started = await http.start(request(host.cookie), room.id);
  assert.equal(started.status, 200);
  assert.equal((await started.json()).data.answer, null);
  assert.equal((await http.guess(request(host.cookie, { playerId: '' }), room.id)).status, 400);
  assert.equal(
    (
      await http.guess(
        request(host.cookie, { playerId: 'match-player-a', participantId: friend.id }),
        room.id
      )
    ).status,
    400
  );
  const saved = await db.matchRoom.findUniqueOrThrow({ where: { id: room.id } });
  const win = await http.guess(request(friend.cookie, { playerId: saved.answerPlayerId }), room.id);
  assert.equal(win.status, 200);
  assert.equal((await win.json()).data.winnerId, friend.id);
});

test('live socket worker keeps extra tabs alive and broadcasts a disconnect forfeit', async () => {
  const host = await guest();
  const friend = await guest();
  const room = await rooms.create(host.id);
  await rooms.join(room.id, friend.id);
  await rooms.ready(room.id, host.id, true);
  await rooms.ready(room.id, friend.id, true);
  await rooms.start(room.id, host.id);
  const server = createServer();
  const realtime = attachRoomSockets(server, db, 'https://zuyiba.test');
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const sockets: ReturnType<typeof connectSocket>[] = [];
  const connect = async (cookie: string) => {
    const socket = connectSocket(`http://127.0.0.1:${address.port}`, {
      transports: ['websocket'],
      reconnection: false,
      extraHeaders: { cookie, origin: 'https://zuyiba.test' },
      auth: { roomId: room.id },
    });
    sockets.push(socket);
    await new Promise<void>((resolve, reject) => {
      socket.once('room:changed', () => resolve());
      socket.once('connect_error', reject);
    });
    return socket;
  };
  const until = async (check: () => Promise<boolean>) => {
    const end = Date.now() + 5000;
    while (!(await check())) {
      if (Date.now() > end) throw new Error('Presence update timed out');
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  };
  try {
    const first = await connect(host.cookie);
    const second = await connect(host.cookie);
    const other = await connect(friend.cookie);
    const stale = new Date(Date.now() - RECONNECT_GRACE_MS - 1000);
    first.disconnect();
    await db.matchParticipant.updateMany({
      where: { roomId: room.id, participantId: host.id },
      data: { lastSeenAt: stale },
    });
    await until(
      async () =>
        (
          await db.matchParticipant.findUniqueOrThrow({
            where: { roomId_participantId: { roomId: room.id, participantId: host.id } },
          })
        ).lastSeenAt > stale
    );
    assert.equal((await matches.read(room.id, host.id)).status, 'PLAYING');
    const disconnectedAt = new Date();
    second.disconnect();
    await until(
      async () =>
        (
          await db.matchParticipant.findUniqueOrThrow({
            where: { roomId_participantId: { roomId: room.id, participantId: host.id } },
          })
        ).lastSeenAt >= disconnectedAt
    );
    let notified = false;
    other.on('room:changed', () => {
      notified = true;
    });
    await db.matchParticipant.updateMany({
      where: { roomId: room.id, participantId: host.id },
      data: { lastSeenAt: stale },
    });
    await until(
      async () => (await matches.read(room.id, friend.id)).status === 'FINISHED' && notified
    );
    const result = await matches.read(room.id, friend.id);
    assert.equal(result.winnerId, friend.id);
    assert.equal(result.finishReason, 'DISCONNECT');
  } finally {
    await realtime.close();
    sockets.forEach((socket) => socket.disconnect());
    server.close();
  }
});

test('sockets require same-origin authenticated membership and send only invalidation hints', async () => {
  const host = await guest();
  const outsider = await guest();
  const room = (await (await http.create(request(host.cookie))).json()).data;
  const server = createServer();
  const realtime = attachRoomSockets(server, db, 'https://zuyiba.test');
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}`;
  const sockets: ReturnType<typeof connectSocket>[] = [];
  function connect(cookie: string, origin = 'https://zuyiba.test') {
    const socket = connectSocket(url, {
      transports: ['websocket'],
      reconnection: false,
      timeout: 2000,
      extraHeaders: { cookie, origin },
      auth: { roomId: room.id },
    });
    sockets.push(socket);
    return socket;
  }
  try {
    for (const [cookie, origin] of [
      ['', 'https://zuyiba.test'],
      [outsider.cookie, 'https://zuyiba.test'],
      [host.cookie, 'https://evil.test'],
    ]) {
      await new Promise<void>((resolve, reject) => {
        const socket = connect(cookie, origin);
        socket.once('connect_error', () => resolve());
        socket.once('connect', () => reject(new Error('Unauthorized socket connected')));
      });
    }
    const socket = connect(host.cookie);
    const nextHint = () =>
      new Promise<unknown[]>((resolve, reject) => {
        const listener = (...args: unknown[]) => {
          clearTimeout(timeout);
          resolve(args);
        };
        const timeout = setTimeout(() => {
          socket.off('room:changed', listener);
          reject(new Error('Timed out waiting for room update'));
        }, 5000);
        socket.once('room:changed', listener);
      });
    assert.deepEqual(await nextHint(), []);
    const hint = nextHint();
    const response = await http.ready(request(host.cookie, { isReady: true }), room.id);
    assert.equal(response.status, 200);
    assert.deepEqual(await hint, []);
  } finally {
    sockets.forEach((socket) => socket.disconnect());
    await realtime.close();
    server.close();
  }
});
