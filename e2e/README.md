# Browser and API tests

Use Node 20.19+ (or a supported newer Node) and start your local PostgreSQL server.
The local connection in `.env` must have permission to create databases.
Playwright is pinned to 1.55.1 for this Mac's macOS 13 compatibility. Upgrade the
test runner/browser together after upgrading macOS or when moving the suite to CI.
Use this older browser only for local testing, not general browsing.

```bash
nvm use 20
npm install
npx playwright install chromium
npm test
npm run test:e2e
```

To watch the browser or run only desktop tests:

```bash
npm run test:e2e -- --headed --project=desktop
```

The wrapper creates a uniquely named `zuyiba_e2e_<random id>` database,
applies the Prisma schema without reset/data-loss flags, and inserts nine
fictional players. Only Alpha Answer belongs to an elite club, making NORMAL
mode deterministic without adding test-only endpoints to the application.
The production build runs at port 3100 with a separate `.next-e2e` build directory.
An existing server on that port is never reused.
Before browser assertions, setup requests verify each API route is ready. Testing
a production build avoids development compilation and hot-reload timing effects.

Tests use the real Next.js routes and PostgreSQL, not mocked HTTP responses.
Desktop and mobile Chromium cover one-letter search, suggestion alignment,
wrong-guess colors/arrows, refresh persistence, winning and restarting.
API tests cover hidden answers, invalid requests, missing records, duplicates,
eight-attempt losses, completed-game rejection, and optional comparison fields.
Unit tests cover field combinations and fixed-date birthday boundaries.

The wrapper removes only the database it created after success or failure.
Force-killing the wrapper can leave a temporary database behind; its exact name
is printed at startup. Never run database cleanup against the normal `zuyiba`
database. Browser failures retain traces/screenshots under `test-results`.

This is an initial regression suite, not proof that every possible error is
covered. It does not audit the factual accuracy of the CSV, all world-country
continent mappings, simultaneous guesses, all browsers, or every network failure.
Height and preferred foot are currently hidden in the table, so they are tested
in unit/API tests rather than as visible browser columns.
