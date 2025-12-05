# Multi-stage Dockerfile for Smart Apply API (Optimized)
# Expected size reduction: ~3.5GB → ~800MB

# Stage 1: Build dependencies
FROM node:20-alpine AS deps

WORKDIR /app

# Tell Puppeteer to skip downloading Chrome (we use system Chromium)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_SKIP_DOWNLOAD=true

# Install build dependencies
RUN apk add --no-cache openssl python3 make g++

# Copy root package files first (needed for workspace)
COPY package.json package-lock.json ./

# Create apps directory structure
RUN mkdir -p apps/api

# Copy API package.json
COPY apps/api/package.json ./apps/api/

# Copy Prisma schema (needed for production dependencies)
COPY apps/api/prisma ./apps/api/prisma

# Install ONLY API production dependencies (no dev deps, no web packages)
# Prisma client will be generated via postinstall hook
RUN --mount=type=cache,target=/root/.npm \
    npm ci --workspace=apps/api --omit=dev --legacy-peer-deps && \
    npm cache clean --force && \
    rm -rf /root/.npm/_logs && \
    rm -rf /tmp/*

# Stage 2: Build application
FROM node:20-alpine AS builder

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
RUN mkdir -p apps/api

# Copy API package.json
COPY apps/api/package.json ./apps/api/

# Copy Prisma schema BEFORE npm install (needed for postinstall hooks)
COPY apps/api/prisma ./apps/api/prisma

# Install only API workspace dependencies to save memory in CI/CD
# Note: This installs API deps + shared root deps (like @nestjs/cli)
RUN --mount=type=cache,target=/root/.npm \
    NODE_OPTIONS="--max-old-space-size=4096" \
    npm ci --workspace=apps/api --include-workspace-root --legacy-peer-deps && \
    npm cache clean --force

# Copy API source code and config
COPY apps/api/src ./apps/api/src
COPY apps/api/test ./apps/api/test
COPY apps/api/tsconfig*.json ./apps/api/
COPY apps/api/nest-cli.json ./apps/api/

# Copy prompts directory (needed at runtime)
COPY apps/api/prompts ./apps/api/prompts

# Build application
RUN npm run api:build

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
FROM node:20-alpine AS production

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

# Copy Prisma client from deps (already generated there)
COPY --from=deps /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=deps /app/node_modules/@prisma ./node_modules/@prisma

# Copy built application (compiled JS only)
COPY --from=builder /app/dist ./dist

# Copy necessary runtime files
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/prompts ./prompts
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
