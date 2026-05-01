# Smart Apply

AI-powered job application assistant — generate tailored, ATS-optimized cover letters and resumes from your profile and any job posting.

## ✨ Features

- **Profile management** — Skills, Experience, Education, Certificates, Projects, Languages
- **Smart job ingestion** — Paste text, URL, or upload (PDF/DOCX); URL parsing via Azure AI Foundry agents (Indeed, LinkedIn, Glassdoor)
- **AI generation** — Azure OpenAI (GPT-4o) with LangChain/LangGraph orchestration; pluggable providers (Azure OpenAI, Hugging Face, mock)
- **Multi-language** — Automatic language detection (DE/EN) for prompts and templates
- **ATS-optimized PDFs** — 50 templates (5 designs × 5 languages × 2 types), Puppeteer + Handlebars
- **Resume parser** — Upload an existing resume to bootstrap your profile
- **Real-time updates** — SSE for live application pipeline status
- **Mock interviews** — AI-generated interview questions per job
- **Auth & security** — JWT in HttpOnly cookies, refresh-token rotation, multi-device sessions, OAuth (Google, Microsoft, Azure AD), 2FA (TOTP), CSRF, rate limiting, audit logs, Sentry
- **Subscriptions** — Tiered plans with usage limits
- **Transactional email** — Resend integration

## 🛠️ Tech Stack

| Layer          | Technology                                                                  |
| -------------- | --------------------------------------------------------------------------- |
| **Frontend**   | Next.js 16 · React 19 · Tailwind v4 · shadcn/ui · TanStack Query · Zustand  |
| **Backend**    | NestJS 11 · Prisma 6 (pg adapter) · Neon Postgres (pooled + direct) · Pino · Helmet |
| **AI**         | Azure AI Foundry · Azure OpenAI · LangChain · LangGraph · Hugging Face      |
| **PDF**        | Puppeteer 24 · Handlebars · pdf-lib · pdf-parse · mammoth (DOCX)            |
| **Storage**   | Cloudflare R2 (S3-compatible, EU jurisdiction) · local disk (pluggable)    |
| **Queue**      | Upstash QStash · in-memory (pluggable)                                     |
| **Cache**      | Upstash Redis · node-cache                                                  |
| **Monorepo**   | npm workspaces · Turborepo                                                  |
| **Deployment** | Docker · Azure Container Apps (API; Fly.io migration planned) · Cloudflare Workers / OpenNext (Web) |
| **Monitoring** | Sentry · Winston (audit logs, daily rotation)                               |

## 🚀 Quick Start

### Prerequisites

- Node.js **24+** (or 20.19+) and npm 10+
- A Postgres database — either:
  - a **[Neon](https://neon.tech)** project (recommended; the EU/Frankfurt region keeps GDPR), or
  - **Docker Desktop** for a local Postgres container.

### Setup

```bash
# 1. Install dependencies (workspaces)
npm install

# 2. Provision Postgres
#    Option A — Neon (recommended): create a project, then set both
#    DATABASE_URL (pooled, hostname contains `-pooler`) and DIRECT_URL
#    (unpooled) in apps/api/.env. See apps/api/.env.example for the format.
#
#    Option B — Local Docker Postgres:
docker compose -f infra/docker-compose.yml up -d db

# 3. Configure environment
cp .env.example .env
# (edit apps/api/.env and apps/web/.env.local as needed)

# 4. Migrate & seed database (includes 50 PDF templates)
#    Migrations + seed use DIRECT_URL when set (required for Neon),
#    falling back to DATABASE_URL for plain Postgres.
npm --workspace @smart-apply/api run prisma:migrate
npm --workspace @smart-apply/api run prisma:seed
npm --workspace @smart-apply/api run prisma:seed:templates

# 5. Run API + Web in parallel (Turborepo)
npm run dev
```

### Access

| Service           | URL                          |
| ----------------- | ---------------------------- |
| **Frontend**      | <http://localhost:3001>      |
| **API**           | <http://localhost:3000>      |
| **Swagger Docs**  | <http://localhost:3000/docs> |
| **Prisma Studio** | <http://localhost:5555>      |

### Demo Login

- **Email:** `demo@smartapply.com`
- **Password:** `Demo123!`

## 📁 Project Structure

```text
smart-apply/
├── apps/
│   ├── api/                      # NestJS backend (Port 3000)
│   │   ├── src/
│   │   │   ├── admin/            # Admin dashboard endpoints
│   │   │   ├── agents/           # Azure AI Foundry agents
│   │   │   ├── applications/     # Generation pipeline
│   │   │   ├── auth/             # JWT, OAuth, 2FA, sessions
│   │   │   ├── contact/          # Contact form
│   │   │   ├── email/            # Resend transactional email
│   │   │   ├── health/           # Terminus health checks
│   │   │   ├── interviews/       # AI mock interviews
│   │   │   ├── job-postings/     # Text/URL/file parsers
│   │   │   ├── jobs/             # Queue providers
│   │   │   ├── keywords/         # ATS keyword matching
│   │   │   ├── linkedin-jobs/    # LinkedIn job search
│   │   │   ├── llm/              # LLM provider abstraction
│   │   │   ├── pdf/              # Puppeteer + Handlebars
│   │   │   ├── profile/          # Profile CRUD
│   │   │   ├── resume-parser/    # PDF/DOCX → Profile
│   │   │   ├── storage/          # Disk/Blob/S3
│   │   │   ├── subscription/     # Plans & limits
│   │   │   ├── templates/        # Template catalog
│   │   │   ├── uploads/          # File upload endpoints
│   │   │   └── user-preferences/
│   │   └── prisma/               # Schema, migrations, seeds
│   └── web/                      # Next.js 16 frontend (Port 3001)
├── packages/shared/              # Shared types
├── docs/                         # Feature, guide & security docs
├── infra/                        # Docker & Compose
└── scripts/                      # Deploy & maintenance
```

## 🔧 Common Commands

```bash
# Development
npm run dev               # API + Web (Turborepo)
npm run api:dev           # API only
npm run web:dev           # Web only

# Build
npm run build             # All workspaces (Turborepo cache)
npm run build:api
npm run build:web

# Database
npm run prisma:migrate
npm run prisma:studio
npm run prisma:seed
npm run prisma:seed:templates

# Testing
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:all          # unit + integration + e2e

# Lint & typecheck
npm run lint
npm run typecheck
```

## 🔒 Security

- JWT in HttpOnly cookies (XSS-protected) + refresh-token rotation
- Multi-device session tracking with remote logout (max 5/user)
- OAuth (Google, Microsoft, Azure AD) and TOTP-based 2FA
- argon2 password hashing, password-strength enforcement
- Helmet, restrictive CORS whitelist, optional CSRF (csrf-csrf)
- Rate limiting (5/15min auth · 100/15min standard)
- Input sanitization (`@Sanitize()` + DOMPurify)
- Winston audit logs (daily rotation, 90-day retention)
- Sentry error & performance monitoring

See [docs/security/](docs/security/) for details.

## 🌐 Deployment

- **API** → Azure Container Apps — see [docs/guides/AZURE_DEPLOYMENT.md](docs/guides/AZURE_DEPLOYMENT.md)
- **Web** → Cloudflare Workers via OpenNext (`npm run cf:deploy` in `apps/web`)
- **CI/CD** → GitHub Actions with Azure OIDC

## 📖 Documentation

| Document                                     | Description            |
| -------------------------------------------- | ---------------------- |
| [ARCHITECTURE.md](ARCHITECTURE.md)           | System architecture    |
| [QUICKSTART.md](QUICKSTART.md)               | Detailed setup guide   |
| [docs/features/](docs/features/)             | Feature specs          |
| [docs/guides/](docs/guides/)                 | Operational guides     |
| [docs/security/](docs/security/)             | Security documentation |
| [docs/implementation/](docs/implementation/) | Implementation notes   |

## 📄 License

MIT
