# Multi-stage Dockerfile for Smart Apply API

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./
COPY nest-cli.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY apps ./apps

# Generate Prisma client
RUN npm run prisma:generate

# Build backend only (not frontend)
RUN npm run api:build

# Stage 2: Production dependencies
FROM node:20-alpine AS deps

WORKDIR /app

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

# Copy all package.json files for workspace dependencies
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY apps/web/package*.json ./apps/web/

# Install all dependencies including workspace packages (needed for Swagger and other runtime deps in main.ts)
RUN npm ci && npm cache clean --force

# Copy Prisma schema and generate client (needed for runtime Prisma enums)
COPY apps/api/prisma ./apps/api/prisma
RUN npm run prisma:generate

# Stage 3: Development
FROM node:20-alpine AS development

# Install Chromium for Puppeteer
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Tell Puppeteer to skip installing Chrome
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "run", "start:dev"]

# Stage 4: Production
FROM node:20-alpine AS production

# Install Chromium and OpenSSL for Puppeteer and Prisma
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    openssl

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    NODE_ENV=production

WORKDIR /app

# Copy production dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/prompts ./prompts
COPY package*.json ./

# Create storage directory
RUN mkdir -p /app/storage

# Run as non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 && \
    chown -R nestjs:nodejs /app

USER nestjs

EXPOSE 3000

CMD ["node", "dist/apps/api/main"]
