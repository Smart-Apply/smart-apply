# Smart Apply — System Architecture

## 🏗️ High-Level Architecture

```text
                                  ┌─────────────────────────────┐
         Browser  ───────────────▶│   Cloudflare Edge / DNS     │
                                  │   (WAF · CDN · Proxy 🟧)    │
                                  └─────┬──────────────┬────────┘
                                        │              │
                  smart-apply.io        │              │  api.smart-apply.io
                  www.smart-apply.io    │              │
                                        ▼              ▼
┌──────────────────────────────────────────────┐  ┌─────────────────────────────────┐
│        Next.js 16 Frontend (Worker)          │  │     NestJS 11 API (Fly.io)      │
│  React 19 · Tailwind v4 · shadcn/ui          │  │  Region: fra · auto-scale 1..N  │
│  Cloudflare Workers (OpenNext)               │  │  Let's Encrypt cert via Fly     │
│  Runtime API URL via /api/config             │  │                                 │
└──────────────────────┬───────────────────────┘  │  ┌──────┬───────┬──────┬─────┐  │
                       │ HTTPS · HttpOnly cookies │  │ Auth │Profile│ Jobs │ LLM │  │
                       │   (CSRF Double-Submit)   │  └──────┴───────┴──────┴─────┘  │
                       └─────────────────────────▶│  ┌──────┬───────┬──────┬─────┐  │
                                                  │  │ PDF  │Resume │Inter │Email│  │
                                                  │  │ pool │parser │views │     │  │
                                                  │  └──────┴───────┴──────┴─────┘  │
                                                  └────┬────┬────┬────┬────┬───┬───┘
                                                       │    │    │    │    │   │
                                                       ▼    ▼    ▼    ▼    ▼   ▼
                                            ┌─────────┐ ┌────────┐ ┌─────────┐ ┌────────┐ ┌──────┐ ┌────────┐
                                            │  Neon   │ │  CF R2 │ │ Upstash │ │ Azure  │ │Sentry│ │Resend  │
                                            │Postgres │ │ (EU)   │ │ QStash /│ │   AI   │ │      │ │ (mail) │
                                            │ EU/Frkft│ │        │ │  Redis  │ │Foundry │ │(APM) │ │        │
                                            │ pooled+ │ │        │ │         │ │+OpenAI │ │      │ │        │
                                            │ direct  │ │        │ │         │ │        │ │      │ │        │
                                            └─────────┘ └────────┘ └─────────┘ └────────┘ └──────┘ └────────┘
```

> **Pluggable providers:** Storage (Cloudflare R2 / disk), Queue (QStash / in-memory),
> LLM (Azure OpenAI / Azure AI Foundry / mock), and Cache (Upstash Redis / node-cache) are all selected via env.

### Production hostnames

| Hostname                    | Origin                                                | Notes                                              |
| --------------------------- | ----------------------------------------------------- | -------------------------------------------------- |
| `smart-apply.io` (apex)     | Cloudflare Worker `smart-apply-web` (Custom Domain)   | Universal Edge Cert (Cloudflare)                   |
| `www.smart-apply.io`        | Cloudflare Worker `smart-apply-web` (Custom Domain)   | Same Worker; redirect rule TBD for canonical host  |
| `api.smart-apply.io`        | CNAME → `93ke51y.smart-apply-api.fly.dev` (Proxied 🟧) | Let's Encrypt cert issued by Fly via DNS-01        |
| `_acme-challenge.api.…`     | CNAME → `api.smart-apply.io.93ke51y.flydns.net` (DNS-only) | Required for Fly cert renewal behind CF proxy |
| `_fly-ownership.api.…`      | TXT `app-93ke51y`                                     | Required when traffic is proxied via Cloudflare    |

## 📦 Monorepo Structure (pnpm Workspaces + Turborepo)

```text
smart-apply/
├── package.json              # Workspace root
├── turbo.json                # Turborepo pipeline
├── apps/
│   ├── api/                  # @smart-apply/api (NestJS 11)
│   │   ├── src/
│   │   │   ├── admin/             # Allow-listed admin endpoints (ADMIN_EMAILS)
│   │   │   ├── agents/            # Azure AI Foundry agents
│   │   │   ├── applications/      # Generation pipeline
│   │   │   ├── auth/              # JWT, OAuth, 2FA, sessions, refresh tokens
│   │   │   ├── common/            # Guards, filters, decorators (@Sanitize)
│   │   │   ├── config/            # Zod env schema
│   │   │   ├── contact/           # Contact form
│   │   │   ├── email/             # Resend transactional email
│   │   │   ├── health/            # Terminus health checks
│   │   │   ├── interviews/        # AI mock interview generator
│   │   │   ├── job-postings/      # Text/URL/file parsers
│   │   │   ├── jobs/              # Queue providers (QStash / mem)
│   │   │   ├── keywords/          # ATS keyword extraction & matching
│   │   │   ├── linkedin-jobs/     # LinkedIn job search (Apify, Premium-only source)
│   │   │   ├── job-search/        # Unified multi-source search (pluggable JobSearchProvider: LinkedIn + Arbeitnow)
│   │   │   ├── llm/               # LLM provider abstraction
│   │   │   ├── logger/            # Pino + Winston audit
│   │   │   ├── mailbox-sync/      # Email Tracking (Premium): MS Graph OAuth + classifier
│   │   │   ├── pdf/               # Thin façade over pdf-v2 (kept for caller API stability)
│   │   │   ├── pdf-v2/            # @react-pdf/renderer (TSX templates) + PNG previews
│   │   │   ├── prisma/            # PrismaService (pg adapter)
│   │   │   ├── profile/           # Profile CRUD (differential updates)
│   │   │   ├── resume-parser/     # PDF/DOCX → Profile bootstrap
│   │   │   ├── storage/           # Cloudflare R2 / disk providers
│   │   │   ├── subscription/      # Plans & usage limits
│   │   │   ├── templates/         # Template catalog
│   │   │   ├── uploads/           # Upload endpoints
│   │   │   └── user-preferences/  # Per-user settings
│   │   ├── prisma/                # Schema, migrations, seeds
│   │   └── test/                  # Unit / integration / e2e
│   │
│   └── web/                  # @smart-apply/web (Next.js 16)
│       ├── src/
│       │   ├── app/               # App Router (route groups)
│       │   ├── components/        # UI + shadcn/ui + pdf
│       │   ├── hooks/             # Custom React hooks
│       │   ├── lib/               # api-client, providers, utils
│       │   ├── stores/            # Zustand
│       │   └── types/             # Shared TS types
│       └── public/                # Static assets
│
├── packages/shared/          # Shared types/utils
├── docs/                     # Feature, guide, security, implementation docs
├── infra/                    # Dockerfiles, docker-compose, nginx
└── scripts/                  # Deploy & maintenance
```

## 🔄 Application Generation Pipeline

```text
User → Frontend (Next.js)
        │
        │ POST /api/v1/applications
        ▼
┌──────────────────────────────────────┐
│ ApplicationsService                  │
│ 1. Validate job posting              │
│ 2. Enforce subscription limits       │
│ 3. Create record (PENDING)           │
│ 4. Publish to queue                  │
└──────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────┐
│ Queue (QStash / in-memory)           │
└──────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────┐
│ Job Processor                        │
│ 1. Status → GENERATING (SSE push)    │
│ 2. Load Profile + JobPosting         │
│ 3. Detect language (DE/EN)           │
│ 4. Select template (lang × design)   │
│ 5. Extract ATS keywords              │
└──────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────┐
│ LLM Service                          │
│ Provider: Azure OpenAI (GPT-4o) /    │
│           Azure AI Foundry / mock    │
│ Circuit-breaker + retries (opossum)  │
│ 1. Generate cover letter             │
│ 2. Generate resume                   │
└──────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────┐
│ PDF Service (@react-pdf/renderer)    │
│ 1. Resolve template via              │
│    pdf-v2/template-registry.ts       │
│ 2. Render TSX → PDF buffer           │
│ Throws if no react-pdf factory is    │
│ registered for the template (no      │
│ fallback path — puppeteer removed    │
│ in v1.16).                           │
└───────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────┐
│ Storage (Cloudflare R2 / disk)       │
│ 1. Upload PDFs                       │
│ 2. Generate pre-signed URLs          │
│ 3. Persist keys in Application       │
│ 4. Status → READY (SSE push)         │
└──────────────────────────────────────┘
```

## 🗄️ Database Schema (Prisma 6)

### Core Models

| Model              | Description                            |
| ------------------ | -------------------------------------- |
| **User**           | Auth, OAuth identities, 2FA secrets    |
| **Profile**        | Personal info, contact, summary        |
| **Skill**          | Skills with level & category           |
| **Experience**     | Work history                           |
| **Education**      | Education history                      |
| **Certificate**    | Certifications                         |
| **Project**        | Portfolio projects                     |
| **Language**       | Language proficiency                   |
| **JobPosting**     | Parsed job listings                    |
| **Application**    | Generated applications + PDFs          |
| **ResumeTemplate** | PDF templates (50 variants)            |
| **Interview**      | AI-generated interview Q&A             |
| **RefreshToken**   | Rotated refresh tokens                 |
| **Session**        | Device/IP/UA tracking                  |
| **Subscription**   | Plan & usage counters                  |
| **AuditLog**       | Security event log                     |

### Key Relations

```text
User 1:1 Profile
Profile 1:N Skills, Experiences, Education, Certificates, Projects, Languages
User 1:N JobPostings, Applications, RefreshTokens, Sessions, Interviews
Application N:1 JobPosting
Application N:1 ResumeTemplate
User 1:1 Subscription
```

## 🔐 Security Architecture

### Authentication Flow

```text
1. Login (email/password OR OAuth: Google / Microsoft / Azure AD)
   → Optional 2FA challenge (TOTP via otplib)
   → Access token (HttpOnly cookie, ~15 min)
   → Refresh token (HttpOnly cookie, 7 days, rotated)
2. Access token expires → silent refresh via /auth/refresh
3. Refresh token rotation on every use; reuse triggers session revoke
4. Max 5 concurrent sessions/user (oldest evicted)
5. Remote logout per session (cron cleanup of expired)
```

### Security Layers

| Layer          | Implementation                                     |
| -------------- | -------------------------------------------------- |
| **Transport**  | HTTPS, HSTS                                        |
| **Headers**    | Helmet, CSP, X-Frame-Options, X-Content-Type-Opts  |
| **Auth**       | JWT (HttpOnly cookies) + refresh rotation + 2FA    |
| **OAuth**      | Google, Microsoft, Azure AD (passport)             |
| **Rate Limit** | 5/15min auth · 100/15min standard (`@nestjs/throttler`) |
| **Input**      | class-validator DTOs, `@Sanitize()` + DOMPurify    |
| **CSRF**       | csrf-csrf (Double Submit Cookie, optional)         |
| **Passwords**  | argon2id, strength regex                           |
| **Audit**      | Winston daily-rotated logs (90-day retention)      |
| **Monitoring** | Sentry (errors + performance)                      |

## 🔧 Technology Stack

### Backend (NestJS 11)

| Category    | Technology                                           |
| ----------- | ---------------------------------------------------- |
| Runtime     | Node.js 24 (>= 20.19)                                |
| Framework   | NestJS 11                                            |
| Database    | Neon Postgres (serverless, EU/Frankfurt; pooled + direct URLs) |
| ORM         | Prisma 6.19 (`@prisma/adapter-pg` + connection pool) |
| Auth        | passport-jwt · passport-google · passport-microsoft · passport-azure-ad · argon2 · otplib (2FA) |
| Queue       | Upstash QStash · in-memory                           |
| Cache       | Upstash Redis · node-cache                           |
| Storage     | Cloudflare R2 (S3-compatible) · local disk           |
| LLM         | Azure AI Foundry · Azure OpenAI · mock               |
| PDF         | `@react-pdf/renderer` 4.5 (TSX templates) · `pdfjs-dist` + `@napi-rs/canvas` (PNG previews) · `pdf-parse` · `mammoth` (DOCX intake) |
| Email       | Resend                                               |
| Logging     | Pino (req logs) + Winston (audit, daily rotation)    |
| Monitoring  | Sentry (`@sentry/node` + profiling)                  |
| Validation  | class-validator · Zod · sanitize-html                |
| Resilience  | opossum (circuit breaker) |
| Scheduling  | `@nestjs/schedule` (cron jobs)                       |
| Health      | `@nestjs/terminus`                                   |

### Frontend (Next.js 16)

| Category    | Technology                                           |
| ----------- | ---------------------------------------------------- |
| Framework   | Next.js 16.1 (App Router, React Compiler enabled)    |
| Language    | TypeScript (strict)                                  |
| UI          | React 19.2 · shadcn/ui (Radix) · Tailwind v4         |
| State       | Zustand 5 · TanStack Query 5                         |
| Forms       | react-hook-form 7 · Zod (`@hookform/resolvers`)      |
| PDF Viewer  | react-pdf · pdfjs-dist                               |
| Editor      | Tiptap 3 (StarterKit + TextStyle)                    |
| Toast       | Sonner                                               |
| Files       | react-dropzone · jszip                               |
| Sanitize    | isomorphic-dompurify                                 |
| Markdown    | marked · turndown                                    |
| Bundle      | Cloudflare Workers (OpenNext) · `@next/bundle-analyzer` |

### Infrastructure

| Category   | Technology                                    |
| ---------- | --------------------------------------------- |
| Container  | Docker (multi-stage, `infra/Dockerfile`)      |
| API host   | **Fly.io** (`smart-apply-api`, region `fra`, shared-cpu-1x / 1 GB) |
| Web host   | Cloudflare Workers via `@opennextjs/cloudflare` (`smart-apply-web`) |
| CI/CD      | GitHub Actions — `ci.yml` (PR checks) + `deploy-staging.yml` (auto on `main`) + `deploy-prod.yml` (gated on `v*.*.*` tag) + `release-please.yml` (SemVer + CHANGELOG) |
| Secrets    | Fly Secrets (API) · Cloudflare Worker vars/secrets (Web) · `.env` (dev) |
| Database   | Neon Postgres (serverless, EU/Frankfurt; `DATABASE_URL` pooled, `DIRECT_URL` for migrations) |
| DNS/CDN    | Cloudflare (proxied for all hostnames; ACME challenge DNS-only) |
| Migrations | `prisma migrate deploy` runs as a Fly **release command** before machines start serving traffic |

## 📊 API Endpoints (selection)

All routes are prefixed `/api/v1` and documented at <http://localhost:3000/docs>.

### Public

| Method | Endpoint                | Description           |
| ------ | ----------------------- | --------------------- |
| POST   | `/auth/register`        | Register              |
| POST   | `/auth/login`           | Email/password login  |
| POST   | `/auth/refresh`         | Rotate access token   |
| GET    | `/auth/oauth/google`    | OAuth (Google)        |
| GET    | `/auth/oauth/microsoft` | OAuth (Microsoft)     |
| GET    | `/auth/csrf-token`      | CSRF token (optional) |
| GET    | `/health`               | Health check          |
| POST   | `/contact`              | Contact form          |

### Protected

| Method   | Endpoint                       | Description              |
| -------- | ------------------------------ | ------------------------ |
| GET      | `/auth/me`                     | Current user             |
| GET      | `/auth/logout`                 | Logout                   |
| POST     | `/auth/2fa/setup`              | TOTP enrollment          |
| POST     | `/auth/2fa/verify`             | TOTP verification        |
| GET/PUT  | `/profile`                     | Profile (differential)   |
| POST     | `/resume-parser/parse`         | Resume → profile         |
| GET/POST | `/job-postings`                | Job CRUD                 |
| POST     | `/job-postings/parse`          | Parse text/URL/file      |
| GET      | `/linkedin-jobs/search`        | LinkedIn job search (legacy, single-source) |
| GET      | `/job-search/sources`          | Configured job-search sources + per-tier availability |
| POST     | `/job-search`                  | Multi-source job search (LinkedIn + Arbeitnow, deduped) |
| POST     | `/job-search/import`           | Persist a search result as a JobPosting     |
| GET/POST | `/applications`                | Application pipeline     |
| GET      | `/applications/:id/files`      | SAS download URLs        |
| GET      | `/applications/:id/stream`     | SSE status stream        |
| POST     | `/interviews`                  | Generate mock interview  |
| GET      | `/mailbox-sync/connections`    | List connected mailboxes (Premium)         |
| GET      | `/mailbox-sync/microsoft/connect` | Start MS Graph OAuth (Premium)          |
| GET      | `/mailbox-sync/microsoft/callback` | OAuth redirect target (public)         |
| POST     | `/mailbox-sync/microsoft/webhook`  | MS Graph push notifications (public)   |
| DELETE   | `/mailbox-sync/connections/:id` | Disconnect mailbox (Premium)              |
| GET      | `/templates`                   | Template catalog         |
| GET      | `/sessions`                    | Active sessions          |
| DELETE   | `/sessions/:id`                | Remote logout            |
| GET      | `/subscription`                | Plan & usage             |
| GET      | `/admin/users?email=`          | Admin: search users (allow-listed) |
| POST     | `/admin/users/:email/tier`     | Admin: set subscription tier (allow-listed) |
| DELETE   | `/admin/users/:email`          | Admin: permanently delete user (allow-listed) |
| GET/PUT  | `/user-preferences`            | Settings                 |

## 🚀 Deployment

### Development

```bash
pnpm dev          # API + Web in parallel (Turborepo)
pnpm api:dev      # NestJS on :3000
pnpm web:dev      # Next.js on :3001
```

### Production

We run **two independent environments** (staging + prod) on sister Fly
apps + Cloudflare Workers + Neon branches. Each environment has its own
secrets, scoped Fly tokens, and Worker namespace. Promotion happens via
Git tags created by release-please when its Release PR is merged.

```text
PR opened   → ci.yml runs (lint, tests, lockfile, migration dry-run)
Merge to main → deploy-staging.yml fires (auto, no approval)
                + release-please opens / updates a Release PR
Merge Release PR → PAT pushes tag v1.x.y → deploy-prod.yml fires
                 → blocks at `production` GitHub Environment gate
                 → you click "Approve and deploy" → prod ships
```

| Environment | API (Fly app)              | Web (Worker)                                          | DB (Neon branch) | R2 bucket             |
| ----------- | -------------------------- | ----------------------------------------------------- | ---------------- | --------------------- |
| **Staging** | `smart-apply-api-staging`  | `smart-apply-web-staging` (`*.workers.dev`)           | `staging`        | `smart-apply-staging` |
| **Prod**    | `smart-apply-api`          | `smart-apply-web` (`smart-apply.io`)                  | `main`           | `smart-apply-prod`    |

Fly config files split per env: [`fly.prod.toml`](./fly.prod.toml) and
[`fly.staging.toml`](./fly.staging.toml). Both use the same `infra/Dockerfile`;
staging uses a smaller VM (1x/1GB) with `min_machines_running = 0` (suspend
on idle) to minimise cost.

```text
GitHub Actions
  ├── ci.yml (PR-triggered)
  │     ├─ lint + lockfile sync check
  │     ├─ unit tests (currently non-blocking, see CONTRIBUTING.md)
  │     └─ migration-check (per-PR Neon branch + prisma migrate deploy dry-run)
  │
  ├── deploy-staging.yml (push to main)
  │     ├─ API → Fly (smart-apply-api-staging, fly.staging.toml)
  │     └─ Web → Cloudflare Worker (smart-apply-web-staging, env.staging block)
  │
  ├── release-please.yml (push to main)
  │     └─ Maintains Release PR + creates v*.*.* tags via PAT
  │
  └── deploy-prod.yml (tag v*.*.* push)
        ├─ Blocks at `production` GitHub Environment (manual approval)
        ├─ API → Fly (smart-apply-api, fly.prod.toml)
        │   ├─ Release command: prisma migrate deploy (Neon DIRECT_URL)
        │   ├─ Secrets via `flyctl secrets set` (CORS_ORIGINS, JWT_*, R2_*, ...)
        │   ├─ HTTPS terminated by Fly (Let's Encrypt for api.smart-apply.io)
        │   └─ Backed by Neon Postgres · Cloudflare R2 · Upstash QStash/Redis
        └─ Web → Cloudflare Worker (smart-apply-web, OpenNext)
            ├─ Build with NEXT_PUBLIC_API_URL injected from PUBLIC_API_URL env
            ├─ Runtime config served at /api/config (single source of truth)
            └─ wrangler deploy
```

> ⚠️ **PUBLIC_API_URL trap:** the GitHub Actions workflow honours the
> `PUBLIC_API_URL` repo Variable as an override. Leave it **unset** in
> production so the workflow default (`https://api.smart-apply.io/api/v1`)
> wins. Setting it to a `*.fly.dev` URL bakes the wrong origin into the
> Worker and breaks CORS / cookies. See [docs/guides/DOMAIN_CLOUDFLARE_SETUP.md](docs/guides/DOMAIN_CLOUDFLARE_SETUP.md).

## 📈 Performance & Resilience

| Feature             | Implementation                              |
| ------------------- | ------------------------------------------- |
| **Template cache**  | In-memory cache (TTL)                       |
| **Browser pool**    | (removed in v1.16 — react-pdf has no browser dependency) |
| **Circuit breaker** | `opossum` around LLM calls                  |
| **DB indexes**      | Targeted indexes; cursor-based pagination   |
| **Compression**     | gzip middleware                             |
| **Soft delete**     | Logical deletion across user data           |
| **SSE**             | Real-time pipeline status                   |
| **N+1 prevention**  | Prisma `include`/select tuning              |
| **CDN**             | Cloudflare in front of Workers              |

---

See [docs/](docs/) for feature specs, security notes, and implementation guides.
