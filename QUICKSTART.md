# Quick Start Guide

Get Smart Apply running in 5 minutes.

## Prerequisites

- **Node.js** 24+ (or 20.19+) with [corepack](https://nodejs.org/api/corepack.html) enabled
- **Docker Desktop** (running)
- **pnpm** 9+ (installed below via corepack)

## Setup

### 1. Install pnpm + dependencies

```bash
corepack enable && corepack prepare pnpm@11.1.2 --activate
pnpm install
```

### 2. Start Database

```bash
docker compose -f infra/docker-compose.yml up -d db
```

### 3. Configure Environment

The repo ships with two committed templates — one per app — that you copy
to a local `.env` (gitignored):

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

The defaults run **fully offline** (Docker Postgres, `disk` storage,
`in-memory` job queue, `mock` LLM). To exercise real services, flip the
matching `*_DRIVER` / `LLM_PROVIDER` variable in `apps/api/.env` and
uncomment the credential block beneath it. See the comments in
`apps/api/.env.example` for the full menu.

> **Note:** Staging & production secrets live in Fly Secrets and
> Cloudflare Worker secrets — never in a committed file. See
> [docs/guides/DEVOPS_ROADMAP.md](docs/guides/DEVOPS_ROADMAP.md).

### 4. Setup Database

```bash
pnpm prisma:migrate           # apply migrations
pnpm prisma:seed              # seed demo user + sample data
pnpm prisma:seed:templates    # seed PDF resume / cover-letter templates
```

### 5. Start Development Servers

```bash
pnpm dev
```

This starts both:

- **API** on <http://localhost:3000>
- **Frontend** on <http://localhost:3001>

## Verify Installation

| Check          | URL                                     |
| -------------- | --------------------------------------- |
| Frontend loads | <http://localhost:3001>                 |
| API responds   | <http://localhost:3000/api/v1/health>   |
| Swagger Docs   | <http://localhost:3000/docs>            |

## Demo Login

- **Email:** `demo@smartapply.com`
- **Password:** `Demo123!`

## Common Commands

```bash
# Start individual services
pnpm api:dev       # Backend only (Port 3000)
pnpm web:dev       # Frontend only (Port 3001)

# Database
pnpm prisma:studio # GUI for database
pnpm prisma:seed   # Re-seed demo data

# Testing
pnpm test:unit     # Unit tests (fast, no DB)
pnpm test:e2e      # E2E tests (requires test DB)
```

## Troubleshooting

### Database connection fails

```bash
# Check if Docker is running
docker ps

# Check database container
docker compose -f infra/docker-compose.yml logs db
```

### Prisma errors

```bash
# Regenerate Prisma Client
pnpm prisma:generate

# Reset database (Warning: deletes all data)
npx prisma migrate reset --schema=apps/api/prisma/schema.prisma
```

### Port already in use

```bash
# Kill processes on ports 3000/3001
lsof -ti:3000 | xargs kill -9
lsof -ti:3001 | xargs kill -9
```

### Dependencies issues

```bash
# Clean install
rm -rf node_modules apps/api/node_modules apps/web/node_modules
pnpm install
```

### Real LLM / R2 / QStash needed

Each pluggable provider in `apps/api/.env.example` has a commented
credential block beneath the driver setting. Flip the driver
(e.g. `LLM_PROVIDER=azure-openai`), uncomment the block, paste your
keys, and restart `pnpm start:dev`. QStash additionally requires a
public webhook URL — use `ngrok` or `cloudflared tunnel` locally.

## What's Included

| Feature                     | Status |
| --------------------------- | ------ |
| User Registration & Login   | ✅     |
| Profile Management          | ✅     |
| Job URL Parsing             | ✅     |
| AI Cover Letter Generation  | ✅     |
| AI Resume Generation        | ✅     |
| PDF Export                  | ✅     |
| Real-time Status Updates    | ✅     |
| Template Selection          | ✅     |
| Session Management          | ✅     |

## Next Steps

1. **Create a profile** — add your skills, experience, education
2. **Add a job posting** — paste a URL from Indeed, LinkedIn, etc.
3. **Generate application** — select a template and create your documents

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) — system architecture overview
- [docs/guides/DEVOPS_ROADMAP.md](docs/guides/DEVOPS_ROADMAP.md) — multi-stage env, secrets, releases
- [docs/guides/TEMPLATE_GUIDE.md](docs/guides/TEMPLATE_GUIDE.md) — template system guide
- [docs/](docs/) — full documentation
