# Multi-stage Dockerfile for Smart Apply API (pnpm).
#
# Strategy:
#   Stage 1 (builder)    — install full workspace (incl. dev deps) with pnpm,
#                          build shared, generate Prisma client, build API,
#                          compile Prisma seed scripts.
#   Stage 2 (deployer)   — `pnpm deploy --prod` produces an isolated, hoisted
#                          production node_modules tree for apps/api with the
#                          workspace-shared package resolved into a real copy.
#   Stage 3 (production) — Alpine runtime; copies the deployed tree + the
#                          compiled dist + runtime assets. No pnpm in this
#                          image (no installs at boot).
#
# Expected final image: ~750 MB (Chromium for Playwright is the biggest chunk).

ARG NODE_VERSION=26
ARG PNPM_VERSION=11.1.2

# ---------------------------------------------------------------------------
# Stage 1: builder — install + compile
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS builder

WORKDIR /app

# Build deps for argon2, prisma engines, etc.
RUN apk add --no-cache openssl python3 make g++

# Install pnpm. node:26-alpine doesn't ship corepack in PATH, so we install
# pnpm directly via npm. The version must match package.json#packageManager
# to avoid pnpm's runDepsStatusCheck failing on every command.
ARG PNPM_VERSION
RUN npm install -g pnpm@${PNPM_VERSION}

# Set higher memory limit for pnpm install / Nest build.
ENV NODE_OPTIONS="--max-old-space-size=6144"

# Copy ALL workspace package.json + lockfile + workspace config first so that
# `pnpm install` can be cached as long as no manifest changed.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/

# Prisma config + schema must exist BEFORE install — apps/api's postinstall
# hook runs `prisma generate` which reads them.
COPY apps/api/prisma.config.ts ./apps/api/
COPY apps/api/prisma ./apps/api/prisma
COPY apps/api/scripts ./apps/api/scripts

# Install full workspace (dev deps included — needed for nest build, tsc, swc).
# `--filter @smart-apply/api...` would skip the web workspace, but we need
# turbo to be able to build packages/shared too, so install the full graph.
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# Copy source AFTER install so manifest changes don't bust the source layer.
COPY packages/shared/tsconfig.json ./packages/shared/
COPY packages/shared/src ./packages/shared/src
COPY apps/api/tsconfig*.json ./apps/api/
COPY apps/api/nest-cli.json ./apps/api/
COPY apps/api/src ./apps/api/src
COPY apps/api/test ./apps/api/test
COPY apps/api/prompts ./apps/api/prompts
COPY turbo.json ./

# Build shared first (api imports its compiled output).
RUN pnpm --filter @smart-apply/shared build

# Re-run prisma generate so the post-generate sanitizer picks up the now-present
# scripts/sanitize-prisma-client.js. Needed because the postinstall during
# `pnpm install` ran before scripts/ was copied (the `|| true` swallows the
# missing-file error there). See apps/api/scripts/sanitize-prisma-client.js
# and the repo memory note about Node 24 + Prisma client ESM compatibility.
RUN pnpm --filter @smart-apply/api prisma:generate

# Build the Nest app — outputs to workspace-root dist/apps/api/ per
# apps/api/tsconfig.json#outDir.
RUN pnpm --filter @smart-apply/api build

# Compile Prisma seed scripts to JavaScript so the runtime image doesn't need
# ts-node. Output goes to apps/api/prisma/dist/.
RUN echo '{"extends":"./tsconfig.json","compilerOptions":{"module":"commonjs","target":"ES2021","outDir":"./prisma/dist","moduleResolution":"node","esModuleInterop":true,"skipLibCheck":true,"resolveJsonModule":true,"allowSyntheticDefaultImports":true,"baseUrl":"."},"include":["prisma/seed.ts","prisma/seed-all.ts","prisma/seed-multilingual-templates.ts","prisma/seed-templates-autodiscover.ts"]}' > apps/api/tsconfig.seed.json && \
    cd apps/api && pnpm exec tsc --project tsconfig.seed.json

# ---------------------------------------------------------------------------
# Stage 2: deployer — `pnpm deploy --prod` for a clean isolated tree
# ---------------------------------------------------------------------------
# `pnpm deploy` resolves @smart-apply/shared (a workspace dep) into a real
# copy inside node_modules so the production stage doesn't need a symlink
# back into packages/shared.
FROM builder AS deployer

WORKDIR /app

RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm --filter @smart-apply/api deploy --prod --legacy /prod/api

# ---------------------------------------------------------------------------
# Stage 3: production runtime
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS production

# Runtime-only deps. Chromium is for Playwright (apps/api/src/agents/url
# parser uses headless browse). dumb-init handles signals correctly under
# Fly's process supervisor.
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    openssl \
    dumb-init && \
    rm -rf /var/cache/apk/*

ENV NODE_ENV=production \
    NPM_CONFIG_LOGLEVEL=error \
    PLAYWRIGHT_BROWSERS_PATH=0 \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

WORKDIR /app

# Create non-root user + storage dir BEFORE any COPY so we can use
# `COPY --chown=...` and avoid a `chown -R /app` at the end. The latter
# is a notorious Docker pitfall: changing ownership on every file produces
# a new layer that duplicates every byte of node_modules (~600 MB extra
# image size). Setting ownership per-COPY keeps each layer at its real size.
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 && \
    mkdir -p /app/storage && \
    chown -R nestjs:nodejs /app

# Bring the entire deployed tree (node_modules + apps/api/package.json +
# prisma config + prompts + prisma migrations). pnpm deploy copies anything
# inside the package boundary, so files outside apps/api/ (notably the
# compiled dist at /app/dist/apps/api/) need separate COPY steps below.
COPY --chown=nestjs:nodejs --from=deployer /prod/api ./apps/api

# The Nest build outputs to workspace-root dist/apps/api/ — outside the
# apps/api package boundary, so `pnpm deploy` doesn't include it.
COPY --chown=nestjs:nodejs --from=builder /app/dist ./dist

# Email templates (Handlebars .hbs partials) are loaded at runtime by
# EmailService via path.join(__dirname, 'templates'), where __dirname is
# /app/dist/apps/api/email/.
COPY --chown=nestjs:nodejs --from=builder /app/apps/api/src/email/templates ./dist/apps/api/email/templates

# Prompt templates loaded by ApplicationsService at runtime. The path
# resolution in code expects /app/prompts.
COPY --chown=nestjs:nodejs --from=builder /app/apps/api/prompts ./prompts

# Root package.json so that `node` reports the right version on `--version`
# checks and so that scripts (e.g. `node dist/apps/api/main`) inherit any
# top-level config.
COPY --chown=nestjs:nodejs --from=builder /app/package.json ./package.json

# Symlink node_modules so the compiled dist at /app/dist/apps/api/main.js
# can resolve @nestjs/core, @prisma/client, etc. The Nest build outputs to
# /app/dist/apps/api/ (per apps/api/tsconfig.json#outDir), and Node walks up
# from there looking for node_modules. Without this symlink it stops at /app
# and throws MODULE_NOT_FOUND, because pnpm deploy put all deps inside
# /app/apps/api/node_modules/ (workspace-local layout) rather than hoisting
# them to /app/node_modules/.
RUN ln -s apps/api/node_modules /app/node_modules && \
    chown -h nestjs:nodejs /app/node_modules

# Clean transient files (no pnpm store, no apk cache).
RUN rm -rf /tmp/* /root/.cache

USER nestjs

EXPOSE 3000

CMD ["dumb-init", "node", "dist/apps/api/main"]
