# CLAUDE.md — ZuYiBa（足一把）

## Role

You are acting as a senior Staff Software Engineer responsible for designing and implementing a production-quality full-stack web application.

You are helping build **ZuYiBa（足一把）**, a football player guessing game that will be used as a portfolio project for software engineering roles in Australia.

Do not treat this project as a toy application, tutorial, coding exercise, or disposable prototype.

The application should demonstrate professional software engineering practices, including:

- maintainable architecture
- clear separation of concerns
- strict typing
- secure backend design
- reliable validation
- automated testing
- responsive and accessible UI
- clean documentation
- production-ready deployment

Every technical decision should balance:

1. maintainability
2. simplicity
3. readability
4. testability
5. security
6. scalability

Do not introduce unnecessary complexity merely to appear sophisticated.

---

# Product Name

## Chinese Name

**足一把**

## English Brand Name

**ZuYiBa**

## English Product Description

**Guess the Footballer**

## Recommended Display

```text
足一把
Guess the Footballer
```

Use **ZuYiBa** in:

- repository naming
- package naming
- internal technical documentation
- metadata where an English identifier is required

Use **足一把** as the primary visible brand name in the Chinese interface.

Suggested repository name:

```text
zuyiba
```

Suggested project slug:

```text
zuyiba-football
```

Do not use copyrighted logos, league branding, or player images without a valid source or licence.

---

# Project Overview

ZuYiBa is an infinite football player guessing game inspired by attribute-comparison games such as Friberg and Wordle-style guessing games.

The user can start a new game at any time.

For each game:

1. The backend randomly selects one football player as the hidden answer.
2. The user searches for a football player.
3. The user submits a guess.
4. The backend compares the guessed player with the hidden player.
5. The frontend displays structured feedback for each player attribute.
6. The user has a maximum of eight attempts.
7. The game ends when the user guesses correctly or uses all eight attempts.
8. The user can immediately start another game.

There is no daily challenge in the MVP.

The primary MVP mode is:

```text
Infinite Mode
```

---

# Product Goal

The goal is not only to make the application function.

The goal is to create a portfolio project that demonstrates professional full-stack engineering ability.

A recruiter or engineering manager reviewing the repository should be able to see evidence of:

- thoughtful architecture
- secure API design
- strong TypeScript usage
- clean React component design
- database modelling
- automated testing
- accessibility awareness
- CI/CD
- production deployment
- clear technical documentation

The repository should feel like a small but real product maintained by a professional engineer.

---

# MVP Scope

The MVP must include only one game mode:

```text
Infinite Mode — Five Major European Leagues
```

The supported leagues are:

- Premier League
- La Liga
- Bundesliga
- Serie A
- Ligue 1

During early development, use approximately 30 representative players.

After the full game loop is stable, expand the dataset to approximately 150–300 well-known active players.

Do not attempt to include every professional football player.

The initial player pool should prioritise recognisable players so that the game remains enjoyable and reasonably solvable.

---

# Core Game Rules

Each game must follow these rules:

- The backend selects one random active player.
- The hidden player must not be exposed while the game is active.
- The user has a maximum of eight valid guesses.
- Duplicate guesses are not allowed.
- Invalid player IDs do not count as attempts.
- Failed API requests do not count as attempts.
- The game becomes immutable after it is won or lost.
- A completed game cannot accept additional guesses.
- A new game must receive a new game session ID.
- The user may start another game immediately after completion.

---

# Player Comparison Attributes

The MVP should compare the following attributes:

1. nationality
2. club
3. league
4. position
5. age
6. height
7. preferred foot

The UI should display feedback using:

- green for exact match
- yellow for partial match
- grey for incorrect match
- upward arrow when the hidden value is higher
- downward arrow when the hidden value is lower

The direction must always describe the hidden answer relative to the guessed player.

Example:

```text
Guessed height: 180 cm
Hidden height: 191 cm
Result: higher
```

This means the hidden player is taller.

---

# Position Matching

Detailed positions should map to broader position groups.

Recommended position groups:

```ts
type PositionGroup = 'GOALKEEPER' | 'DEFENDER' | 'MIDFIELDER' | 'FORWARD';
```

Example:

```text
Guessed position: Central Midfielder
Hidden position: Defensive Midfielder
```

If both belong to `MIDFIELDER`, the comparison result should be:

```text
partial
```

If the exact positions match, return:

```text
correct
```

If the position groups differ, return:

```text
incorrect
```

Position normalisation must be implemented as domain logic, not inside React components.

---

# Age Handling

Do not store age directly.

Store:

```text
birthDate
```

Calculate age consistently on the server.

The same age-calculation function should be reused across:

- comparison logic
- API responses
- tests
- result rendering where appropriate

Avoid frontend and backend age calculations producing different values.

Use a clearly defined comparison date, preferably the game creation date or current UTC date.

---

# Technology Stack

## Frontend

- Next.js using the App Router
- React
- TypeScript
- Tailwind CSS
- shadcn/ui

## Backend

- Next.js Route Handlers
- TypeScript

## Database

- PostgreSQL
- Prisma ORM

## Validation

- Zod

## Testing

- Vitest
- React Testing Library
- Playwright

## CI/CD

- GitHub Actions

## Deployment

- Vercel

## Hosted Database

Use one of:

- Neon PostgreSQL
- Supabase PostgreSQL

Do not introduce NestJS, Redis, GraphQL, microservices, message queues, or event-driven architecture in the MVP unless there is a demonstrated requirement.

---

# Data Source Strategy

Do not use a live football API in the MVP.

Do not scrape websites.

Do not depend on live football data.

The application should use a curated local football player dataset imported into PostgreSQL.

The data pipeline should be:

```text
players.csv
    ↓
validation and normalisation
    ↓
Prisma seed script
    ↓
PostgreSQL
```

Required player fields should include:

```text
name
slug
nationality
countryCode
club
league
position
positionGroup
birthDate
heightCm
preferredFoot
active
popularity
```

Optional fields:

```text
imageUrl
clubLogoUrl
```

The seed process must:

- validate required fields
- reject malformed rows
- normalise enum-like values
- prevent duplicate slugs
- produce useful error messages
- be safe to run more than once where practical

Once seeded, the core game must not require external football data services.

---

# External Resource Policy

The MVP may rely on:

- PostgreSQL hosting
- Vercel
- GitHub
- npm packages
- optional analytics after the core MVP is complete

The MVP must not require:

- football APIs
- live match feeds
- live transfer feeds
- automated player scraping
- paid sports data subscriptions

Player images are optional.

If image licensing is unclear, omit player images from the MVP.

The quality of the game logic and interface is more important than player photography.

---

# Architecture Principles

Prefer:

- feature-based organisation
- small focused modules
- explicit domain logic
- reusable components
- server-side validation
- typed API contracts
- predictable error responses
- dependency boundaries
- testable pure functions
- semantic HTML
- accessible interaction patterns

Avoid:

- giant React components
- business logic inside JSX
- Prisma queries directly scattered across UI code
- duplicated validation
- duplicated comparison logic
- hidden global state
- unnecessary abstractions
- speculative architecture
- excessive generic utility layers
- premature optimisation

Use SOLID principles pragmatically.

Do not create interfaces, factories, repositories, or abstraction layers unless they provide a clear benefit.

---

# Recommended Project Structure

```text
zuyiba/
├── app/
│   ├── api/
│   │   ├── games/
│   │   │   ├── route.ts
│   │   │   └── [gameId]/
│   │   │       ├── route.ts
│   │   │       └── guesses/
│   │   │           └── route.ts
│   │   └── players/
│   │       └── search/
│   │           └── route.ts
│   ├── about/
│   │   └── page.tsx
│   ├── privacy/
│   │   └── page.tsx
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   └── ui/
├── features/
│   ├── game/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── types/
│   │   └── utils/
│   └── player-search/
│       ├── components/
│       ├── hooks/
│       └── types/
├── lib/
│   ├── api/
│   ├── database/
│   ├── validation/
│   └── utils/
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── data/
│       └── players.csv
├── tests/
│   ├── unit/
│   ├── integration/
│   └── components/
├── e2e/
├── public/
├── types/
├── .github/
│   └── workflows/
├── .env.example
├── CLAUDE.md
└── README.md
```

This is a guideline, not an absolute rule.

Do not create empty folders that serve no immediate purpose.

---

# Database Models

The initial schema should include:

- Player
- GameSession
- Guess

Use enums where they improve consistency.

Recommended concepts:

```text
GameStatus
PositionGroup
PreferredFoot
League
```

Avoid over-normalising the MVP database.

Separate Club and Country tables are not required unless there is a concrete need.

The Player model should remain straightforward to seed and query.

---

# Game Session Security

The hidden player ID must remain server-side.

Never send the hidden player ID or complete hidden player object to the client while the game status is `PLAYING`.

Do not rely on client-side state for:

- attempt count
- game status
- duplicate-guess detection
- answer validation
- win detection
- loss detection

The server is the source of truth.

The client may store only the current game ID for recovery.

Recommended client persistence:

```text
localStorage
```

Store:

```text
currentGameId
```

Do not store the hidden answer or authoritative game state in localStorage.

---

# API Design

The MVP should provide these endpoints.

## Create Game

```http
POST /api/games
```

Responsibilities:

- select a random eligible player
- create a game session
- return safe public game state

---

## Get Game

```http
GET /api/games/:gameId
```

Responsibilities:

- return current status
- return attempts used
- return previous guesses
- return previous comparison results
- return answer only when the game is complete

---

## Submit Guess

```http
POST /api/games/:gameId/guesses
```

Responsibilities:

- validate game ID
- validate player ID
- reject duplicate guesses
- reject guesses for completed games
- perform comparison
- persist the guess
- update game status
- return safe public state

The guess creation and game-state update should be performed transactionally where appropriate.

---

## Search Players

```http
GET /api/players/search?q=
```

Responsibilities:

- validate and trim the query
- avoid querying for meaningless short input
- return a limited number of results
- search case-insensitively
- return only public player summary fields
- rank more recognisable players higher where practical

Recommended result limit:

```text
10
```

---

# API Response Design

Use consistent API response shapes.

Success example:

```ts
type ApiSuccess<T> = {
  success: true;
  data: T;
};
```

Error example:

```ts
type ApiError = {
  success: false;
  error: {
    code: string;
    message: string;
    fieldErrors?: Record<string, string[]>;
  };
};
```

Use meaningful HTTP status codes.

Examples:

- `200` successful retrieval
- `201` game or guess created
- `400` invalid request
- `404` game or player not found
- `409` duplicate guess or completed game conflict
- `500` unexpected server error

Do not expose database errors or internal stack traces to the client.

---

# Validation

Use Zod for request validation.

Validate:

- route parameters
- search query
- request body
- CSV rows
- environment variables where practical

Do not trust:

- player IDs from the client
- game IDs from the client
- attempt numbers from the client
- game status from the client
- comparison results from the client

The client submits intent.

The server determines truth.

---

# Random Player Selection

The backend should randomly select an eligible active player.

Eligibility should support future filtering, such as:

- league
- difficulty
- popularity
- active status

For the MVP, use active players from the supported league pool.

Avoid loading the full player table into memory if the final implementation can remain simple and efficient.

However, do not over-engineer random selection for a dataset of only a few hundred players.

Correctness and maintainability are more important than theoretical scale.

---

# Frontend Requirements

The main game interface should include:

- brand header
- Start Game button
- How to Play dialog
- player autocomplete search
- guess results table
- attempt counter
- loading states
- empty states
- error states
- win modal
- loss modal
- New Game button
- share result action
- responsive mobile layout

The UI should primarily support Chinese users.

Use Chinese interface copy for the first version.

Technical identifiers, source code, commit messages, and documentation should remain in English.

---

# Suggested Chinese UI Copy

Brand:

```text
足一把
```

Subtitle:

```text
猜出这名足球运动员
```

Start button:

```text
开始游戏
```

New game:

```text
再来一局
```

Search placeholder:

```text
搜索球员姓名
```

Attempts:

```text
剩余次数
```

Win message:

```text
猜对了！
```

Loss message:

```text
很遗憾，答案是：
```

How to play:

```text
玩法说明
```

Share result:

```text
分享结果
```

Keep all user-facing text in a centralised localisation or constants module.

Do not scatter Chinese strings throughout many components.

---

# Accessibility Requirements

The application should support:

- keyboard navigation
- visible focus states
- labelled form controls
- screen-reader-friendly buttons
- semantic table markup where appropriate
- accessible dialog behaviour
- sufficient colour contrast
- feedback that does not depend only on colour

Comparison cells must include text, icons, or accessible labels in addition to colour.

The player autocomplete should support:

- Arrow Up
- Arrow Down
- Enter
- Escape

---

# Responsive Design

The game must work on:

- mobile
- tablet
- desktop

The guess table may use horizontal scrolling on mobile.

Consider:

- sticky player column
- compact labels
- abbreviated headings
- responsive font sizes
- touch-friendly controls

Do not make desktop the only well-supported layout.

---

# State Management

Do not introduce Redux or another global state library for the MVP unless clearly necessary.

Prefer:

- local component state
- custom hooks
- server state fetched through a simple service layer
- URL or localStorage only where appropriate

The current game ID may be stored in localStorage to restore a game after refresh.

Avoid duplicating authoritative server state unnecessarily.

---

# Error Handling

Handle expected failures clearly.

Examples:

- player not found
- game not found
- duplicate guess
- game already complete
- network error
- invalid request
- database failure
- empty search results

Display useful user-facing errors without exposing technical internals.

Log unexpected server errors in a structured and maintainable way.

Do not silently swallow exceptions.

---

# Testing Strategy

## Unit Tests

Test pure domain logic, including:

- age calculation
- exact attribute comparison
- numeric direction comparison
- position-group comparison
- win detection
- loss detection
- duplicate guess logic
- share-result generation
- player data normalisation

## Integration Tests

Test:

- create-game API
- get-game API
- submit-guess API
- duplicate guess rejection
- completed game rejection
- hidden answer protection
- search API behaviour

## Component Tests

Test:

- search result rendering
- keyboard selection
- loading state
- empty state
- error state
- guess row rendering
- result modal
- New Game action

## End-to-End Tests

At minimum, implement:

```text
Open homepage
→ Start a game
→ Search for a player
→ Submit a guess
→ View comparison feedback
→ Continue guessing
→ Finish the game
→ Start another game
```

Also test game recovery after refresh.

---

# CI Requirements

GitHub Actions should run:

```text
install
→ format check
→ lint
→ type check
→ unit tests
→ build
```

Run Playwright in CI once the E2E setup is stable.

Do not configure CI steps that cannot run reliably in the repository environment.

---

# Environment Variables

Provide:

```text
.env.example
```

Document every variable.

At minimum:

```text
DATABASE_URL
DIRECT_URL
```

Add other variables only when they are actually used.

Never commit secrets.

Validate required environment variables at application startup where practical.

---

# Documentation Requirements

The README should include:

- project overview
- product screenshots
- live demo link
- technology stack
- architecture summary
- local setup instructions
- environment variables
- database migration instructions
- seed instructions
- test commands
- deployment instructions
- API summary
- known limitations
- future roadmap

The README should explain why the project avoids live football APIs in the MVP.

Include a short architecture diagram using Mermaid if useful.

---

# Git and Commit Quality

Work in small, meaningful, reviewable changes.

Suggested commit style:

```text
chore: initialise Next.js project
chore: configure Prisma and PostgreSQL
feat: add player data import pipeline
feat: implement game session creation
feat: implement player search
feat: implement player comparison engine
feat: add responsive game interface
test: add game API integration tests
ci: add GitHub Actions workflow
```

Do not create one enormous commit containing the entire project.

---

# Development Phases

## Phase 1 — Project Initialisation (Completed)

- Next.js with App Router
- TypeScript strict mode
- Tailwind CSS
- shadcn/ui
- ESLint and Prettier
- Prisma with PostgreSQL
- Vitest
- Initial folder structure
- CLAUDE.md
- .env.example
- README

## Phase 2 — Database and Seed Pipeline

- Player, GameSession, Guess models
- Prisma migration
- CSV player data
- Seed script

## Phase 3 — Backend APIs

- POST /api/games
- GET /api/games/:gameId
- POST /api/games/:gameId/guesses
- GET /api/players/search

## Phase 4 — Domain and Business Logic

- Age calculation
- Player comparison engine
- Win/loss detection
- Share result generation

## Phase 5 — Frontend Game Experience

- Homepage
- Player search
- Guess submission
- Results table
- Win/loss modals

## Phase 6 — Testing, CI and Deployment

- Expanded tests
- GitHub Actions
- Vercel deployment

---

# Coding Standards

Always:

- use TypeScript strict mode
- avoid `any`
- use descriptive names
- keep functions focused
- keep components reasonably small
- validate server inputs
- return safe API DTOs
- use semantic HTML
- handle loading and error states
- reuse domain logic
- add tests for important behaviour
- preserve existing working behaviour when refactoring

Never:

- expose the hidden player during an active game
- trust client-submitted game state
- store age directly
- hardcode database IDs
- duplicate comparison logic
- place database access inside client components
- ignore errors
- claim tests passed without running them
- continue to another phase without approval
