# Quick Start Guide

Get Smart Apply running in 5 minutes.

## Prerequisites

- **Node.js** 24+ (or 20.19+)
- **Docker Desktop** (running)
- **npm** 11+

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Start Database

```bash
docker compose -f infra/docker-compose.yml up -d db
```

### 3. Configure Environment

```bash
cp .env.example .env
```

### 4. Setup Database

```bash
npm run prisma:migrate
npm run prisma:seed
```

### 5. Start Development Servers

```bash
npm run dev
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
npm run api:dev       # Backend only (Port 3000)
npm run web:dev       # Frontend only (Port 3001)

# Database
npm run prisma:studio # GUI for database
npm run prisma:seed   # Re-seed demo data

# Testing
npm run test:e2e      # E2E tests
npm run test:unit     # Unit tests
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
npm run prisma:generate

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
npm install
```

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

1. **Create a profile** - Add your skills, experience, education
2. **Add a job posting** - Paste a URL from Indeed, LinkedIn, etc.
3. **Generate application** - Select a template and create your documents

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) - System architecture overview
- [docs/](docs/) - Full documentation
- [docs/guides/TEMPLATE_GUIDE.md](docs/guides/TEMPLATE_GUIDE.md) - Template system guide
