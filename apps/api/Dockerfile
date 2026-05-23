FROM node:24-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# ── deps: install all workspace dependencies ──────────────────────────────────
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/contracts/package.json ./packages/contracts/
RUN HUSKY=0 pnpm install --frozen-lockfile

# ── build: compile the API and contracts ──────────────────────────────────────
FROM deps AS build
COPY packages/contracts ./packages/contracts
COPY apps/api ./apps/api
RUN pnpm --filter @representante-vendas/api build

# ── production deps only ──────────────────────────────────────────────────────
FROM base AS prod-deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/contracts/package.json ./packages/contracts/
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

# ── runtime image ─────────────────────────────────────────────────────────────
FROM node:24-alpine AS runtime
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Copy production node_modules and built output
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/pnpm-workspace.yaml ./pnpm-workspace.yaml

# Migration source files needed by the prod migration runner
COPY --from=build /app/apps/api/src/database ./apps/api/src/database

# Entrypoint script: run migrations then start the app
COPY apps/api/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

WORKDIR /app/apps/api
EXPOSE 3000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
