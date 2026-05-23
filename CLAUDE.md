# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Anna Maria Studio Management — a full-stack web app for managing a Pilates studio, with:

- **Backend**: NestJS 11 + TypeORM + PostgreSQL
- **Frontend**: React 19 + Vite + MUI v9 + TanStack Query + React Router v7
- **Auth**: Firebase Authentication (ID token flow, no passport/jwt)
- **Shared types**: `packages/contracts` — pure TS interfaces consumed by both apps

## Monorepo structure

pnpm workspace with three packages:

- `apps/api` — NestJS 11 backend (`@anna-maria/api`)
- `apps/web` — React 19 + Vite frontend (`@anna-maria/web`)
- `packages/contracts` — shared TypeScript interfaces consumed by both apps (`@anna-maria/contracts`)

## Node version

Always run `nvm use 24` before executing any scripts (pnpm, npx, nest CLI, etc.). The project requires Node 24.

## Commands

All commands run from the repo root unless otherwise noted.

```bash
# Switch to correct Node version first
nvm use 24

# Install dependencies
pnpm install

# Run everything in dev mode (parallel)
pnpm dev

# Run a single app
pnpm --filter @anna-maria/api dev
pnpm --filter @anna-maria/web dev

# Build
pnpm build

# Lint
pnpm lint
pnpm --filter @anna-maria/api lint
pnpm --filter @anna-maria/web lint

# Type-check
pnpm --filter @anna-maria/api type-check
pnpm --filter @anna-maria/web type-check

# Tests
pnpm test
pnpm --filter @anna-maria/api test
pnpm --filter @anna-maria/api test:e2e

# Run a single test file (from apps/api)
pnpm --filter @anna-maria/api test -- --testPathPattern=user

# Database migrations (run from apps/api)
pnpm --filter @anna-maria/api migration:generate -- src/database/migrations/MigrationName
pnpm --filter @anna-maria/api migration:run
pnpm --filter @anna-maria/api migration:revert

# Seed (run from repo root)
pnpm --filter @anna-maria/api seed
```

## Local development with Docker

```bash
docker compose -f docker-compose.dev.yaml up --build
```

This starts PostgreSQL (5432), Adminer UI (8080), the API (3000), and the web app (5173). The Vite dev server proxies `/api/*` to the NestJS container.

Without Docker, copy `.env.example` to `.env` in each app and start a local Postgres instance.

## Architecture

### Authentication — Firebase

Auth is handled by Firebase, not a local JWT system. The flow:

1. **Frontend** signs in via the `firebase` SDK and obtains an ID token.
2. **Frontend** sends the token as `Authorization: Bearer <token>` on every API request.
3. **Backend** (`firebase-auth.guard.ts`) verifies the token with `firebase-admin` and auto-creates a `User` row on first login.
4. The verified Firebase UID maps to the `User` entity — the NestJS request user is a `User`, not a raw Firebase user.

There is no `passport` or `@nestjs/jwt` in this project. Do not introduce them.

Use `@Public()` decorator to mark endpoints that should skip the auth guard.
Use `@CurrentUser()` decorator to inject the authenticated `User` into a controller method.

### NestJS API layout

Each domain lives in its own module folder (`src/modules/<domain>/`) containing entity, service, controller, and DTOs. The `user/` domain lives at `src/user/`.

To add a new domain:
1. Create `src/modules/<domain>/` with `*.module.ts`, `*.service.ts`, `*.controller.ts`, `entities/*.entity.ts`
2. Import the module in `app.module.ts`
3. Generate and run a migration
4. Add the contract interface to `packages/contracts/src/<domain>/`

Global setup in `main.ts`:
- All routes prefixed `/api/v1`
- `ValidationPipe` with `whitelist: true, transform: true`
- Swagger at `/api/v1/docs` with Bearer auth
- CORS origin from `CORS_ORIGIN` env var

The TypeORM `AppDataSource` in `src/database/data-source.ts` is used by the migration CLI; the runtime connection is configured inside `AppModule` via `TypeOrmModule.forRootAsync`.

### Domain event audit trail

`EventService` (`src/event/`) provides a generic `record()` method for writing audit events to the `domain_events` table. Always call it inside a transaction using the passed `EntityManager`.

### Observability

- **Pino** (`nestjs-pino`) for structured JSON logging with request-id and field redaction.
- **PostHog** (`posthog-node` on API, `posthog-js` on web) for error tracking. Only 5xx errors are captured; 4xx are not.
- **OTLP** exporter configured via `OTEL_EXPORTER_OTLP_ENDPOINT`.

### React web layout

```
src/
  App.tsx          — router root, QueryClientProvider, AuthProvider, ErrorBoundary
  theme.ts         — MUI theme (customize palette here)
  api/             — Axios client wrappers, one file per domain
  auth/            — Firebase init, auth context, useAuth hook
  pages/           — one component per route
  components/      — shared UI components (AppLayout, ToastProvider)
  lib/posthog.ts   — PostHog web singleton
```

Vite proxies `/api` to the backend (configured via `API_TARGET` env var in Docker, defaults to `localhost:3000`).

### contracts package

Pure TypeScript interfaces shared between API and web. No runtime code. Import as `@anna-maria/contracts`. Add a new domain interface here whenever you add a new entity.

### TypeORM conventions

- Entities use UUID primary keys.
- `synchronize: false` in all environments — always use migrations.
- Migration files live in `apps/api/src/database/migrations/`.
- Entity files are named `*.entity.ts` and auto-discovered by glob.
- `numeric(10,2)` columns are stored as strings in TypeORM to avoid floating-point precision loss.

### Business rules

- **Class capacity of 4 students is a WARNING only, never a blocker.** The system shows a warning but never prevents enrollment.
- `weekday` convention: 0=Sunday … 6=Saturday.
