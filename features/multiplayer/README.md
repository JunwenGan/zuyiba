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

Before public launch we still need abuse/rate limits, expired-session/room cleanup,
and room-leave/expiry behavior. This checkpoint is not production-complete.

Still to build: answer and guess storage, first-correct-wins handling, Socket.IO
and the UI. No start endpoint is exposed yet: `PLAYING` currently represents only
a repository transition, not a playable multiplayer game.
