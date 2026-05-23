# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A skeleton monorepo template for building full-stack web apps with:

- **Backend**: NestJS 11 + TypeORM + PostgreSQL
- **Frontend**: React 19 + Vite + MUI v9 + TanStack Query + React Router v7
- **Auth**: Firebase Authentication (ID token flow, no passport/jwt)
- **Shared types**: `packages/contracts` — pure TS interfaces consumed by both apps

To start a new project from this template: fork/copy this branch and rename the package names from `@representante-vendas/*` to your own namespace.

## Monorepo structure

pnpm workspace with three packages:

- `apps/api` — NestJS 11 backend (`@representante-vendas/api`)
- `apps/web` — React 19 + Vite frontend (`@representante-vendas/web`)
- `packages/contracts` — shared TypeScript interfaces consumed by both apps

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
pnpm --filter @representante-vendas/api dev
pnpm --filter @representante-vendas/web dev

# Build
pnpm build

# Lint
pnpm lint
pnpm --filter @representante-vendas/api lint
pnpm --filter @representante-vendas/web lint

# Type-check
pnpm --filter @representante-vendas/api type-check
pnpm --filter @representante-vendas/web type-check

# Tests
pnpm test
pnpm --filter @representante-vendas/api test
pnpm --filter @representante-vendas/api test:e2e

# Run a single test file (from apps/api)
pnpm --filter @representante-vendas/api test -- --testPathPattern=user

# Database migrations (run from apps/api)
pnpm --filter @representante-vendas/api migration:generate -- src/database/migrations/MigrationName
pnpm --filter @representante-vendas/api migration:run
pnpm --filter @representante-vendas/api migration:revert
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

Each domain lives in its own module folder (`src/<domain>/`) containing entity, service, controller, and DTOs. The only domain included in this skeleton is `user/`.

To add a new domain:
1. Create `src/<domain>/` with `*.module.ts`, `*.entity.ts`, `*.service.ts`, `*.controller.ts`
2. Import the module in `app.module.ts`
3. Generate and run a migration
4. Add the contract interface to `packages/contracts/src/<domain>/`

Global setup in `main.ts`:
- All routes prefixed `/api`
- `ValidationPipe` with `whitelist: true, transform: true`
- Swagger at `/api/docs` with Bearer auth
- CORS origin from `CORS_ORIGIN` env var

The TypeORM `AppDataSource` in `src/database/data-source.ts` is used by the migration CLI; the runtime connection is configured inside `AppModule` via `TypeOrmModule.forRootAsync`.

### Domain event audit trail

`EventService` (`src/event/`) provides a generic `record()` method for writing audit events to the `domain_events` table. Always call it inside a transaction using the passed `EntityManager`.

### React web layout

```
src/
  App.tsx          — router root, QueryClientProvider, AuthProvider
  theme.ts         — MUI theme (customize palette here)
  api/             — Axios client wrappers, one file per domain
  auth/            — Firebase init, auth context, useAuth hook
  pages/           — one component per route
  components/      — shared UI components (AppLayout, ToastProvider)
```

Vite proxies `/api` to the backend (configured via `API_TARGET` env var in Docker, defaults to `localhost:3000`).

### contracts package

Pure TypeScript interfaces shared between API and web. No runtime code. Import as `@representante-vendas/contracts`. Add a new domain interface here whenever you add a new entity.

### TypeORM conventions

- Entities use UUID primary keys.
- `synchronize: false` in all environments — always use migrations.
- Migration files live in `apps/api/src/database/migrations/`.
- Entity files are named `*.entity.ts` and auto-discovered by glob.
