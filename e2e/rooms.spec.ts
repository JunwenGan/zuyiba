import { test, expect } from '@playwright/test';

test('two browsers keep separate guest identities and share saved lobby state', async ({
  page,
  browser,
}) => {
  const friendContext = await browser.newContext();
  const friend = await friendContext.newPage();
  try {
    await page.goto('/');
    await friend.goto('http://127.0.0.1:3100/');
    // Use real browser fetch: the browser sets Origin and manages HttpOnly cookies.
    const call = async (target: typeof page, path: string, data?: unknown) =>
      target.evaluate(
        async ({ path, data }) => {
          const response = await fetch(
            path,
            data === undefined
              ? {}
              : {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(data),
                }
          );
          return { status: response.status, body: await response.json() };
        },
        { path, data }
      );

    expect((await call(page, '/api/rooms', {})).status).toBe(401);
    const hostSession = await call(page, '/api/multiplayer/session', {});
    const friendSession = await call(friend, '/api/multiplayer/session', {});
    expect(hostSession.status).toBe(201);
    expect(friendSession.status).toBe(201);
    const hostId = hostSession.body.data.participantId;
    const friendId = friendSession.body.data.participantId;
    expect(hostId).not.toBe(friendId);
    expect(await page.evaluate(() => document.cookie)).not.toContain('zuyiba_guest');

    const created = await call(page, '/api/rooms', {});
    expect(created.status).toBe(201);
    const path = `/api/rooms/${created.body.data.id}`;
    expect((await call(friend, path)).status).toBe(404);
    expect((await call(friend, `${path}/join`, {})).status).toBe(200);
    expect(
      (await call(friend, `${path}/ready`, { isReady: true, participantId: hostId })).status
    ).toBe(400);
    expect((await call(friend, `${path}/ready`, { isReady: true })).status).toBe(200);
    await page.reload();
    const loaded = await call(page, path);
    expect(loaded.status).toBe(200);
    expect(loaded.body.data.participants).toEqual(
      expect.arrayContaining([
        { id: hostId, isReady: false },
        { id: friendId, isReady: true },
      ])
    );
    const repeated = await call(page, '/api/multiplayer/session', {});
    expect(repeated.status).toBe(200);
    expect(repeated.body.data.participantId).toBe(hostId);
    expect((await call(page, `${path}/start`, {})).status).toBe(409);
    expect((await call(page, `${path}/ready`, { isReady: true })).status).toBe(200);
    expect((await call(friend, `${path}/start`, {})).status).toBe(403);
    const started = await call(page, `${path}/start`, {});
    expect(started.status).toBe(200);
    expect(started.body.data.status).toBe('PLAYING');
    expect(started.body.data.answer).toBeNull();
    expect(JSON.stringify(started.body)).not.toContain('e2e-player-0');
    const wrong = await call(page, `${path}/guesses`, { playerId: 'e2e-player-1' });
    expect(wrong.status).toBe(200);
    expect(wrong.body.data.guesses).toHaveLength(1);
    const opponent = (await call(friend, path)).body.data;
    expect(opponent.guesses).toHaveLength(0);
    expect(opponent.opponentGuesses).toEqual([
      {
        guessNumber: 1,
        results: {
          nationality: 'partial',
          club: 'incorrect',
          league: 'incorrect',
          position: 'incorrect',
          age: 'incorrect',
        },
      },
    ]);
    expect(JSON.stringify(opponent)).not.toContain('e2e-player-1');
    expect(JSON.stringify(opponent)).not.toContain('Bravo Guess');
    await page.reload();
    expect((await call(page, path)).body.data.guesses).toEqual(wrong.body.data.guesses);
    const winner = await call(friend, `${path}/guesses`, { playerId: 'e2e-player-0' });
    expect(winner.status).toBe(200);
    expect(winner.body.data.status).toBe('FINISHED');
    expect(winner.body.data.winnerId).toBe(friendId);
    expect(winner.body.data.answer.id).toBe('e2e-player-0');
    expect((await call(page, `${path}/guesses`, { playerId: 'e2e-player-0' })).status).toBe(409);
    await page.reload();
    expect((await call(page, path)).body.data.winnerId).toBe(friendId);
  } finally {
    await friendContext.close();
  }
});
