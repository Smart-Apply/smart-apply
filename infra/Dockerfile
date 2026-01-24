# Multi-stage Dockerfile for Smart Apply API (Optimized)
# Expected size reduction: ~3.5GB → ~800MB

# Stage 1: Build dependencies
FROM node:24-alpine AS deps

WORKDIR /app

# Tell Puppeteer to skip downloading Chrome (we use system Chromium)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_SKIP_DOWNLOAD=true

# Install build dependencies
RUN apk add --no-cache openssl python3 make g++

# Copy root package files first (needed for workspace)
COPY package.json package-lock.json ./

# Create apps directory structure
RUN mkdir -p apps/api packages/shared

# Copy API package.json
COPY apps/api/package.json ./apps/api/

# Copy packages/shared (required dependency)
COPY packages/shared/package.json ./packages/shared/
COPY packages/shared/tsconfig.json ./packages/shared/
COPY packages/shared/src ./packages/shared/src

# Copy Prisma config and schema (needed for Prisma 7 generation)
COPY apps/api/prisma.config.ts ./apps/api/
COPY apps/api/prisma ./apps/api/prisma

# Install ONLY API production dependencies (no dev deps, no web packages)
# Prisma client will be generated via postinstall hook to src/generated/prisma
ENV NODE_OPTIONS="--max-old-space-size=6144"
RUN --mount=type=cache,target=/root/.npm \
    npm ci --workspace=apps/api --workspace=packages/shared --omit=dev --legacy-peer-deps

# Stage 2: Build application
FROM node:24-alpine AS builder

WORKDIR /app

# Tell Puppeteer to skip downloading Chrome (we use system Chromium)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_SKIP_DOWNLOAD=true

# Install build dependencies
RUN apk add --no-cache openssl python3 make g++

# Copy root package files (needed for workspace)
COPY package.json package-lock.json ./
COPY tsconfig*.json ./
COPY nest-cli.json ./

# Create apps directory structure
RUN mkdir -p apps/api packages/shared

# Copy API package.json
COPY apps/api/package.json ./apps/api/

# Copy packages/shared (required dependency)
COPY packages/shared/package.json ./packages/shared/
COPY packages/shared/tsconfig.json ./packages/shared/
COPY packages/shared/src ./packages/shared/src

# Copy Prisma config and schema BEFORE npm install (required for Prisma 7)
COPY apps/api/prisma.config.ts ./apps/api/
COPY apps/api/prisma ./apps/api/prisma

# Install only API workspace dependencies to save memory in CI/CD
# Note: This installs API deps + shared root deps (like @nestjs/cli)
ENV NODE_OPTIONS="--max-old-space-size=6144"
RUN --mount=type=cache,target=/root/.npm \
    npm ci --workspace=apps/api --workspace=packages/shared --include-workspace-root --legacy-peer-deps

# Copy API source code and config
COPY apps/api/src ./apps/api/src
COPY apps/api/test ./apps/api/test
COPY apps/api/tsconfig*.json ./apps/api/
COPY apps/api/nest-cli.json ./apps/api/

# Copy prompts directory (needed at runtime)
COPY apps/api/prompts ./apps/api/prompts

# Build shared package first (required by API)
RUN npm run shared:build

# Build application
RUN npm run api:build

# Compile Prisma seed scripts to JavaScript (production-ready)
# Write tsconfig and compile seeds (all relative to /app)
RUN echo '{"extends":"./tsconfig.json","compilerOptions":{"module":"commonjs","target":"ES2021","outDir":"./prisma/dist","moduleResolution":"node","esModuleInterop":true,"skipLibCheck":true,"resolveJsonModule":true,"allowSyntheticDefaultImports":true,"baseUrl":"."},"include":["prisma/seed.ts","prisma/seed-all.ts","prisma/seed-multilingual-templates.ts","prisma/seed-templates-autodiscover.ts"]}' > apps/api/tsconfig.seed.json && \
    cd apps/api && npx tsc --project tsconfig.seed.json

# Remove development dependencies and Web packages after build
RUN npm prune --production && \
    rm -rf apps/web && \
    rm -rf node_modules/@types && \
    rm -rf node_modules/typescript && \
    rm -rf node_modules/eslint* && \
    rm -rf node_modules/jest* && \
    rm -rf node_modules/@nestjs/testing && \
    rm -rf node_modules/webpack* && \
    rm -rf node_modules/.cache

# Stage 3: Production runtime
FROM node:24-alpine AS production

# Install only runtime dependencies (minimal set)
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

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    NODE_ENV=production \
    NPM_CONFIG_LOGLEVEL=error

WORKDIR /app

# Copy ONLY production dependencies from deps stage (no dev deps)
COPY --from=deps /app/node_modules ./node_modules

# Copy Prisma client from builder stage (Prisma 7 generates to src/generated/prisma)
COPY --from=builder /app/apps/api/src/generated ./apps/api/src/generated
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Playwright will use system Chromium (already installed above)
# Set environment variable for Playwright to use system browser
ENV PLAYWRIGHT_BROWSERS_PATH=0 \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# Remove symlink and create real directory for shared package
RUN rm -rf ./node_modules/@smart-apply/shared && \
    mkdir -p ./node_modules/@smart-apply/shared

# Copy built shared package from builder to node_modules (required at runtime)
COPY --from=builder /app/packages/shared/dist ./node_modules/@smart-apply/shared/dist
COPY --from=builder /app/packages/shared/package.json ./node_modules/@smart-apply/shared/package.json

# Copy built application (compiled JS only)
COPY --from=builder /app/dist ./dist

# Copy necessary runtime files
COPY --from=builder /app/apps/api/prisma.config.ts ./apps/api/prisma.config.ts
COPY --from=builder /app/apps/api/prisma/schema.prisma ./apps/api/prisma/schema.prisma
COPY --from=builder /app/apps/api/prisma/migrations ./apps/api/prisma/migrations
COPY --from=builder /app/apps/api/prisma/dist ./apps/api/prisma/dist
COPY --from=builder /app/apps/api/prompts ./prompts
COPY --from=builder /app/apps/api/src/pdf/templates ./apps/api/src/pdf/templates
COPY --from=builder /app/package.json ./package.json

# Clean up any remaining unnecessary files
RUN rm -rf /tmp/* /root/.npm /root/.cache

# Create storage directory with correct permissions
RUN mkdir -p /app/storage && \
    addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 && \
    chown -R nestjs:nodejs /app

USER nestjs

EXPOSE 3000

# Use dumb-init for proper signal handling
CMD ["dumb-init", "node", "dist/apps/api/main"]
