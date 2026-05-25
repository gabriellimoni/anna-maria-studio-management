FROM node:24-alpine AS base
RUN corepack enable && corepack prepare pnpm@11.0.9 --activate
WORKDIR /app

# ── deps: install all workspace dependencies ──────────────────────────────────
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/api/package.json ./apps/api/
COPY packages/contracts/package.json ./packages/contracts/
RUN HUSKY=0 pnpm install --frozen-lockfile

# ── build: compile the API and contracts ──────────────────────────────────────
FROM deps AS build
COPY packages/contracts ./packages/contracts
COPY apps/api ./apps/api
RUN pnpm --filter @anna-maria/api build

# ── standalone deploy bundle (prod deps only, no workspace symlinks) ───────────
FROM build AS deploy
RUN pnpm --filter @anna-maria/api deploy --prod --legacy /app/standalone

# ── runtime image ─────────────────────────────────────────────────────────────
FROM node:24-alpine AS runtime
WORKDIR /app

COPY --from=deploy /app/standalone ./
# Migration source files needed by the prod migration runner
COPY --from=build /app/apps/api/src/database ./src/database

COPY apps/api/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
