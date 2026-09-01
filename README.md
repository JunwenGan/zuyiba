# ZuYiBa (足一把) — Guess the Footballer

An infinite football player guessing game inspired by attribute-comparison games like Wordle.

## Overview

ZuYiBa is a portfolio project demonstrating professional full-stack engineering practices. Players guess football players based on attribute comparisons (nationality, club, league, position, age, height, preferred foot).

## Technology Stack

- **Frontend**: Next.js (App Router), React, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Next.js Route Handlers, TypeScript
- **Database**: PostgreSQL, Prisma ORM
- **Validation**: Zod
- **Testing**: Vitest, React Testing Library, Playwright
- **CI/CD**: GitHub Actions
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 20+
- npm
- PostgreSQL database (local or hosted via Neon/Supabase)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/zuyiba.git
cd zuyiba

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database connection string

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# Seed the database (after Phase 2)
npm run db:seed

# Start development server
npm run dev
```

### Environment Variables

| Variable       | Description                             |
| -------------- | --------------------------------------- |
| `DATABASE_URL` | PostgreSQL connection string for Prisma |
| `DIRECT_URL`   | Direct database URL for migrations      |

## Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript type checking
npm run format       # Format code with Prettier
npm run format:check # Check code formatting
npm run test         # Run unit tests
npm run test:watch   # Run tests in watch mode
```

## Project Structure

```
zuyiba/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   └── page.tsx           # Home page
├── components/ui/         # shadcn/ui components
├── features/              # Feature modules
│   ├── game/             # Game logic
│   └── player-search/    # Player search
├── lib/                   # Shared utilities
│   ├── database/         # Database utilities
│   └── validation/       # Zod schemas
├── prisma/               # Database schema and seeds
├── tests/                # Test files
├── e2e/                  # End-to-end tests
└── types/                # TypeScript types
```

## Development Phases

- [x] Phase 1: Project Initialisation
- [ ] Phase 2: Database and Seed Pipeline
- [ ] Phase 3: Backend APIs
- [ ] Phase 4: Domain and Business Logic
- [ ] Phase 5: Frontend Game Experience
- [ ] Phase 6: Testing, CI and Deployment

## Data Source

This project uses a curated local dataset of football players rather than live APIs to:

- Avoid API rate limits and costs
- Ensure consistent data for testing
- Simplify deployment and maintenance

## License

MIT

## Author

ZuYiBa
