# Friend matches: learning checkpoints

1. `room.ts` defines lobby rules with no database dependency.
2. `room-repository.ts` loads and saves those rules through Prisma/PostgreSQL.
3. `guest-session.ts` supplies cookie-based guest identity; `http.ts` validates
   requests and calls the repository. The files under `app/api/rooms` expose it.

`MatchRoom` stores the host and status. `MatchParticipant` stores each person's
readiness, linked by `roomId`. These participants are humans, not football
records from the existing `Player` table. Participant IDs are not passwords;
API handlers derive them from server-issued guest sessions, never request fields.

Example server-side usage (after applying the migration):

```ts
import { prisma } from '@/lib/database/client';
import { createRoomRepository } from '@/features/multiplayer/room-repository';

const rooms = createRoomRepository(prisma);
const room = await rooms.create(hostSessionId);
await rooms.join(room.id, guestSessionId);
await rooms.ready(room.id, hostSessionId, true);
await rooms.ready(room.id, guestSessionId, true);
await rooms.start(room.id, hostSessionId);
```

Every change locks the room row inside a transaction, reads the latest state,
applies the rule, and saves it. Concurrent changes to that room wait their turn.
Different rooms can proceed independently. Errors roll back the transaction.
The database prevents duplicate membership; the two-person capacity rule relies
on all lobby writes using this repository, not direct table writes.

## Run tests

```bash
nvm use 20
npm run db:generate
npm test
npm run test:integration
```

Integration tests need local PostgreSQL running and `DATABASE_URL` in `.env`.
They create a randomly named database, apply the real migrations, test persistence
and competing writes, then remove only that temporary database. They do not change
your normal database. Force-killing the process can leave the temporary database.

The new migration is additive. To apply pending migrations to your development
database, inspect them first, then run `npx prisma migrate deploy`.

## Step 3: browser API

| Request                         | JSON body             | Purpose                                        |
| ------------------------------- | --------------------- | ---------------------------------------------- |
| `POST /api/multiplayer/session` | `{}`                  | Create guest identity, or reuse a valid cookie |
| `POST /api/rooms`               | `{}`                  | Create room as the current guest               |
| `POST /api/rooms/:roomId/join`  | `{}`                  | Join using the shared room ID                  |
| `GET /api/rooms/:roomId`        | None                  | Read room state (members only)                 |
| `POST /api/rooms/:roomId/ready` | `{ "isReady": true }` | Change your own readiness                      |

With PostgreSQL running, apply pending migrations with `npx prisma migrate deploy`,
regenerate the client with `npm run db:generate`, and start `npm run dev`.
On the app page, try this in the browser's developer console:

```js
await fetch('/api/multiplayer/session', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: '{}',
});
const response = await fetch('/api/rooms', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: '{}',
});
const { data: room } = await response.json();
console.log(room);
```

Use an incognito window or another browser for your friend; normal tabs share the
same guest cookie. Start a guest session there, then POST to the room's `/join` URL.
Writes require JSON and an Origin header matching the app; browser fetch sets
Origin automatically. Terminal clients must provide it explicitly.

The random 256-bit cookie token is HttpOnly; PostgreSQL holds only its SHA-256
hash. Public participant IDs are not credentials. Sessions expire after 30 days;
clearing the cookie or renewing an expired session creates a new identity and
does not recover your old room seat. There is no account recovery yet.

For deployment, set `APP_ORIGIN` to the public **HTTPS** origin. Cookies are Secure
on HTTPS and allow HTTP for local development. Keep these endpoints same-origin;
no cross-origin CORS permission is granted. A room ID acts as an invite: anyone
who has it can take the open seat. API responses are marked `no-store`.

Before public launch we still need abuse/rate limits and expired-session/room cleanup.
This checkpoint is not production-complete.

## Step 4: shared answer and first-correct winner

- `POST /api/rooms/:roomId/start` with `{}`: only the host, with both players ready.
- `POST /api/rooms/:roomId/guesses` with `{ "playerId": "..." }`: submit your guess.
- `GET /api/rooms/:roomId`: reload your feedback and the shared match status.

Start chooses one active normal-mode (elite-club) answer on the server. Clients
cannot choose or read it while playing. Each participant sees their own full
guess history and only the opponent's color results. The answer is revealed to both members
only when the match is `FINISHED`.

Read the code in this order:

1. `app/api/rooms/[roomId]/start/route.ts` → `http.ts` → `room-repository.ts`:
   validate the host/readiness, then save the answer and start time atomically.
2. `app/api/rooms/[roomId]/guesses/route.ts` → `http.ts` → `match-repository.ts`:
   identify the caller, lock the room, validate and save the guess, record a winner.
3. `match-repository.ts` → `state()`: return a safe member-specific response.

Both players lock the SAME room row before guessing. If two correct requests
race, the transaction that acquires the lock first and commits successfully wins;
the other sees `FINISHED`. This is server processing order, not the browser click
timestamp. Incorrect guesses also use the lock but do not end the match.

Retrying an already accepted player guess returns current state without adding
another attempt, including after completion. A new guess after completion is
rejected. Guess feedback is saved as JSON so refreshing preserves it. Age is
calculated at match start for both participants. A matching player ID, not matching
attributes, determines the winner.

Each player has eight guesses. An exhausted player waits while the other can
continue; if both exhaust their guesses without winning, the match ends in a
draw (`FINISHED` with a null `winnerId`) and reveals the answer. The limit and
draw decision run under the same room lock as winning guesses. There is no overall match timer.
Do not import/change player attributes during an active match;
answer-attribute snapshots can be added before supporting live data refreshes.
The migration returns old answer-less `PLAYING` lobbies to `WAITING`; existing
single-player sessions are untouched. Apply it before using the new endpoints.

## Step 5: screen and live updates

Open `/rooms` (or click **好友对战** on the home page). Create a room, copy the
invite URL, and open it in a different browser/incognito window. The friend must
click **加入房间**. Both click **准备**, then the host clicks **开始对战**.
Joining is explicit; simply opening an invitation does not consume a seat.

`RoomLobby.tsx` is the create/invite screen. `RoomGame.tsx` displays the lobby,
search, private guess history, connection status, and final result. It reuses the
single-player search and feedback table. Only the room ID is in the URL; identity
comes from the HttpOnly cookie. Copy has a manual-selection fallback.

Live flow:

1. Browser sends its action to the existing HTTP API.
2. The transaction commits in PostgreSQL.
3. `http.ts` calls `notifyRoom()` in `room-events.ts`.
4. `socket-server.ts` sends a payload-free `room:changed` hint to room members.
5. Each `RoomGame.tsx` fetches its own safe state from the HTTP API.

Sockets check the cookie, Origin and room membership. They cannot submit guesses
or pick a winner. A reconnect triggers a fresh database read, so missed messages
do not erase guesses. Request generations prevent older responses overwriting
newer state. Actions are disabled while disconnected; **刷新状态** can retry the
connection. A `room:presence` event carries only the connected participant IDs.

### Leaving, disconnects and replay

- `POST /api/rooms/:roomId/leave` (`{}`) forfeits an active match after UI confirmation.
- The socket server checks active rooms every second. Connected participants renew
  their persisted `lastSeenAt`; a last-tab disconnect starts a 60-second grace period.
  Socket failure detection itself can take roughly ten seconds. Multiple tabs count
  as one participant; closing only one does not start the grace period.
- One absent participant past the grace period loses to the connected participant.
  If both are absent, wait until both grace periods expire, then finish as
  `ABANDONED` with no winner. Reconnecting after expiry cannot revive a match.
  Persisted timestamps also let the worker recover after a server restart.
- `POST /api/rooms/:roomId/restart` (`{}`) creates a fresh lobby for the same two
  participants with readiness reset. Both see the next-lobby button. It does not
  auto-move the opponent or clear history. Concurrent retries reuse one saved
  `rematchRoomId`. The old host remains the host.
- Apply `20261001000000_match_departures` before starting the updated server:
  `npx prisma migrate deploy`, then `npx prisma generate`.

Presence tracking assumes exactly one Node server process. Do not run two servers
against the same live matches until presence is coordinated across processes.
The one-second database sweep is intentionally simple for this deployment; a
larger deployment needs indexed/batched deadline jobs and shared presence.

### Running the server

`npm run dev` now starts `server.ts`: Next.js and Socket.IO share one HTTP server
on port 3000. Restart an old `next dev` process to use the new entry point. Server
file changes require a restart; Next page/component hot reload still works.
Use `npm run build` then `npm start` for production. `tsx` is needed at runtime.

`PORT` changes the port, `BIND_HOST` changes the bind interface (default
`0.0.0.0`). For a friend on your LAN, open the app using your computer's LAN IP
before copying the invite; `localhost` links work only on the same computer.
Keep the app on a trusted network until public-launch hardening is completed.

Deploy this as a persistent Node process/container with WebSocket proxy support,
not Vercel serverless or Next standalone output. Set `APP_ORIGIN` to the exact
public HTTPS origin (no trailing slash). The current event bridge supports **one
Node process**; multiple processes would need shared pub/sub (e.g. Redis) and a
Socket.IO adapter. PostgreSQL still stores all durable state.

Tests: `npm run test:e2e` includes two real browsers playing via the UI on desktop
and mobile, plus reconnect-after-win and refresh. `npm run test:integration`
also checks socket authorization and that events contain no private game data.

### Opponent color history

`MatchState.opponentGuesses` contains one row per opponent guess: the guess number
and five result classifications (nationality, club, league, position, age).
`opponent-guess.ts` constructs this explicit allowlist on the server. No footballer
ID/name, field values, timestamps, images, or numeric direction hints are sent.
`OpponentGuessTable.tsx` displays the colors with symbols and accessible labels.
The same privacy rule applies after completion (the shared answer is still revealed).
Existing socket notifications refresh both grids; refresh/reconnect reloads the
persisted rows. No database migration is needed for this color-history change.

Still to build before public launch: rate limits, waiting-lobby/session cleanup,
and operational hardening. Replay creates a new room; old rooms are not reset.
