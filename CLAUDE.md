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

### Migration hygiene — prevent schema drift

**Generate a migration immediately after every entity change.** Never batch entity changes across sessions without generating the corresponding migration — TypeORM's `migration:generate` diffs the live DB against entities, so accumulated changes produce bloated migrations full of unrelated noise.

**After generating, run `--dryrun` to review the output:**
```bash
cd apps/api && npx typeorm-ts-node-commonjs migration:generate -d src/database/data-source.ts --dryrun src/database/migrations/Check
```

**Known TypeORM false positive — enum rename cycles:** TypeORM always generates `RENAME TO _old → CREATE same values → DROP _old` cycles for enum columns even when the enum hasn't changed. If the only diff shown by `--dryrun` is these cycles, the schema is clean — do not create a migration for them.

**Do not ignore real drift.** If `--dryrun` shows non-enum changes (new columns, index renames, constraint changes) after a migration was just run, it means entities and DB have diverged — generate and run a migration to fix it before adding more entity changes.

### Domain event audit trail

`EventService` (`src/event/`) provides a generic `record()` method for writing audit events to the `domain_events` table. Always call it inside a transaction using the passed `EntityManager`.

### Observability

- **Pino** (`nestjs-pino`) for structured JSON logging with request-id and field redaction.
- **PostHog** (`posthog-node` on API, `posthog-js` on web) for error tracking. Only 5xx errors are captured; 4xx are not.
- **OTLP** exporter configured via `OTEL_EXPORTER_OTLP_ENDPOINT`.

### React web layout

```
src/
  App.tsx              — router root, QueryClientProvider, AuthProvider, ErrorBoundary
  theme.ts             — MUI theme (customize palette here)
  api/                 — Axios client wrappers, one file per domain
  auth/                — Firebase init, auth context, useAuth hook
  pages/               — one component per route (top-level only)
  features/<domain>/   — self-contained feature slices (api, hooks, pages, components)
  components/          — shared UI components (AppLayout, ToastProvider)
  lib/posthog.ts       — PostHog web singleton
```

Vite proxies `/api` to the backend (configured via `API_TARGET` env var in Docker, defaults to `localhost:3000`).

#### MUI v9 — critical rules

- **Never use shorthand style props** (`display`, `fontWeight`, `alignItems`, etc.) directly on MUI components. All layout/style must go inside `sx={{ ... }}`. Example: use `<Box sx={{ display: 'flex', gap: 2 }}>` not `<Box display="flex" gap={2}>`. This applies to `Box`, `Typography`, `Stack`, and all MUI components.
- `Stack` does not accept `maxWidth` as a direct prop — put it in `sx`.
- **`inputProps` is removed in MUI v9.** For input element styles (e.g. monospace textarea), use `sx` with a CSS selector: `sx={{ '& textarea': { fontFamily: 'monospace', fontSize: 13 } }}`.

#### React hooks lint rules (enforced by eslint-plugin-react-hooks)

- **No `setState` inside `useEffect`** — the linter rejects it. Use derived state instead:
  ```ts
  const [value, setValue] = useState('');
  const [dirty, setDirty] = useState(false);
  const current = dirty ? value : (serverValue ?? '');  // derived, no useEffect needed
  ```
- **No refs accessed during render** — `ref.current` reads are only valid inside event handlers and effects.
- **Functions called in `useEffect` must be defined before the effect** — define `syncSize` (or similar) above the `useEffect` that calls it; ESLint enforces declaration order for non-hoisted references.

#### Public routes (no auth)

Add public routes **outside** the `<AuthGate>` wrapper in `App.tsx`:
```tsx
<Route path="/public-path/:param" element={<PublicPage />} />
```
Authenticated routes stay inside `<Route element={<AuthGate />}>`.

For public API calls, create a **separate axios instance** without the Firebase token interceptor:
```ts
const publicClient = axios.create({ baseURL: '/api/v1' });
```

#### Forms — Zod v4 + react-hook-form

This project uses **Zod v4** and **`@hookform/resolvers` v5**. Key rules:

- Import the resolver as `import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'` — Zod v4 implements the Standard Schema protocol. Do **not** use `@hookform/resolvers/zod` (that targets Zod v3).
- Avoid `z.coerce.number()` — in Zod v4 it infers as `unknown` and breaks TypeScript inference with react-hook-form. Use `z.number()` for fields backed by a `<Select>` (native number values). For text inputs that must coerce, use `z.string().transform(Number)`.

#### ToastProvider

`useToast()` returns the toast function directly — not an object. Use:
```ts
const showToast = useToast();
showToast('message', 'success');
```

### contracts package

Pure TypeScript interfaces shared between API and web. No runtime code. Import as `@anna-maria/contracts`. Add a new domain interface here whenever you add a new entity.

### TypeORM conventions

- Entities use UUID primary keys.
- `synchronize: false` in all environments — always use migrations.
- Migration files live in `apps/api/src/database/migrations/`.
- Entity files are named `*.entity.ts` and auto-discovered by glob.
- `numeric(10,2)` columns are stored as strings in TypeORM to avoid floating-point precision loss.
- **Always specify `type:` explicitly on nullable string columns.** TypeScript compiles `string | null` to `Object` in emitted metadata, and TypeORM throws `DataTypeNotSupportedError: Data type "Object"` at runtime. Add `type: 'varchar'` (or `'text'`) to every nullable string `@Column`.
- **Always verify actual DB column names against the migration SQL** before writing raw queries. The student entity uses `full_name` (not `name`), user uses `"firebaseUid"` (camelCase, not `firebase_uid`). When in doubt, grep `migrations/` for the CREATE TABLE statement.

### Known entity column names (verified against migration SQL)

| Table | TypeScript field | DB column |
|-------|-----------------|-----------|
| `student` | `fullName` | `full_name` |
| `user` | `firebaseUid` | `"firebaseUid"` (camelCase, quoted) |
| `plan_catalog` | `name` | `name` (no `modality` column) |
| `student` | — | no `cpf` column |

### Public endpoints and rate limiting

To expose an endpoint without Firebase auth, use `@Public()` on the controller class or method (from `src/common/decorators/public.decorator.ts`). For rate limiting, install `@nestjs/throttler` and:
1. Add `ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }])` to `AppModule` imports
2. Add `{ provide: APP_GUARD, useClass: ThrottlerGuard }` to `AppModule` providers **after** `FirebaseAuthGuard`
3. Use `@Throttle({ default: { limit: 5, ttl: 60000 } })` on individual endpoints to override the global default

### ESM vs CJS library compatibility

Jest runs in CJS mode. Some libraries are ESM-only and will cause `SyntaxError: Cannot use import statement in a module`:
- **`marked@18+` is ESM-only** — use `marked@^4` which has a CJS entry (`lib/marked.cjs`). Update `@types/marked` to `@types/marked@4` too.
- **`sanitize-html`** default import fails in CJS context — use `require()` with explicit type cast:
  ```ts
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const sanitize = require('sanitize-html') as (html: string, opts: object) => string;
  ```

### Business rules

- **Class capacity of 4 students is a WARNING only, never a blocker.** The system shows a warning but never prevents enrollment.
- `weekday` convention: 0=Sunday … 6=Saturday.

### Domain event audit trail — HARD RULE

**Every user-initiated mutating operation MUST record a domain event.** This is non-negotiable.

Pattern (follow `ContractsService` as reference):
1. Service method accepts `user: User` as a parameter.
2. Wrap the operation in `this.dataSource.transaction(async (manager) => { ... })`.
3. Call `this.eventService.record(manager, { action, entity, entityId, userId: user.id, dto })` inside the transaction, after the save.
4. Controller injects `@CurrentUser() user: User` and passes it to the service method.
5. Add `EventModule` to the module's `imports` array.

Event naming convention: `<entity>.<past-tense-verb>` — e.g. `student.created`, `plan.cancelled`, `receivable.paid`.

When adding a new domain, add unit tests that assert `eventService.record` was called with the correct `action` and `userId`.

## Testing requirements

> **HARD RULE: No backend implementation is done until its tests are written and passing.** This is non-negotiable — a service, controller, scheduler, or any backend feature without tests is considered incomplete, regardless of whether the feature logic itself works.

Every new backend module MUST include automated tests before the feature is considered complete:

- **Unit tests** (mock repo/DataSource via `@nestjs/testing`) for all service methods — happy paths, error paths (NotFoundException, ConflictException), and edge cases. Cover as many meaningful scenarios as the logic warrants.
- **Integration tests** (testcontainers — `@testcontainers/postgresql`) for any method that exercises the DB schema: unique indexes, FK constraints, complex queries, or idempotency logic.
- **Scheduler unit tests** for any `@Cron` class — verify happy path and error path (PostHog capture called on throw).
- **Controller unit tests** — verify route delegation and any DTO-to-domain transformations (e.g. string → Date parsing).

Reference patterns:
- Integration test: `apps/api/src/modules/scheduling/services/__tests__/payable-generator.service.spec.ts`
- Unit test with mocked EntityManager: `apps/api/src/modules/scheduling/services/__tests__/receivable-persist.service.spec.ts`
- Contracts integration test (5 tests, testcontainers): `apps/api/src/modules/contracts/__tests__/contracts.service.integration.spec.ts`
- Integration test files go in `__tests__/` subdirectory; unit tests can live alongside source or also in `__tests__/`.

### Testing patterns and pitfalls

**Mocking EntityManager in unit tests:**
```ts
type AnyFn = (...args: unknown[]) => unknown;
function makeManager(overrides: Record<string, AnyFn> = {}): EntityManager {
  return { save: jest.fn(), findOne: jest.fn(), ...overrides } as unknown as EntityManager;
}
```
Use `let saved: unknown = null` for captures — TypeScript infers `never` for untyped jest captures. Cast at assertion time: `(saved as MyEntity)?.field`.

**`create` mock must include timestamps:** When mocking `manager.create()`, always include `createdAt: new Date(), updatedAt: new Date()` in the returned object — services often spread those fields.

**EventService in integration tests:** Do NOT instantiate `new EventService(...)`. Mock it: `{ record: jest.fn() } as unknown as EventService`.

**Integration test raw SQL:** Run tests with real PostgreSQL via testcontainers. Raw SQL must match actual migration column names — verify against `migrations/` before writing.

**Run a single test file from repo root:**
```bash
cd apps/api && npx jest --testPathPattern="modules/contracts"
```
(The `pnpm --filter` approach with `-- --testPathPattern` doesn't forward correctly due to `rootDir: "src"` in Jest config — run `npx jest` directly from inside `apps/api`.)
