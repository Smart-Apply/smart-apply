# Smart Apply — System Architecture

## 🏗️ High-Level Architecture

```text
┌──────────────────────────────────────────────────────────────────┐
│                       Next.js 16 Frontend                        │
│       (React 19 · Tailwind v4 · shadcn/ui · TanStack Query)      │
│              Cloudflare Workers (OpenNext) · Port 3001           │
└────────────────────────────┬─────────────────────────────────────┘
                             │ HTTPS · HttpOnly cookies
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│                       NestJS 11 API (Port 3000)                  │
│                      Azure Container Apps (auto-scale)           │
│  ┌────────────┬───────────┬───────────┬──────────┬────────────┐  │
│  │   Auth     │  Profile  │   Jobs    │   LLM    │    PDF     │  │
│  │ (JWT/OAuth)│  (CRUD)   │ (parsing) │ (Azure   │(Puppeteer) │  │
│  └────────────┴───────────┴───────────┴──────────┴────────────┘  │
│  ┌────────────┬───────────┬───────────┬──────────┬────────────┐  │
│  │  Resume    │ Interviews│ Templates │  Email   │Subscription│  │
│  │  Parser    │   (AI)    │ (50 PDFs) │ (Resend) │  (Limits)  │  │
│  └────────────┴───────────┴───────────┴──────────┴────────────┘  │
└────┬──────────┬──────────┬──────────┬──────────┬─────────┬──────┘
     │          │          │          │          │         │
     ▼          ▼          ▼          ▼          ▼         ▼
┌─────────┐ ┌────────┐ ┌─────────┐ ┌────────┐ ┌──────┐ ┌────────┐
│Postgres │ │  R2 /  │ │Upstash  │ │ Azure  │ │Sentry│ │Resend  │
│  16     │ │  disk  │ │ QStash /│ │   AI   │ │      │ │ (mail) │
│(pg pool)│ │        │ │  mem    │ │Foundry │ │(APM) │ │        │
│         │ │        │ │         │ │+OpenAI │ │      │ │        │
└─────────┘ └────────┘ └─────────┘ └────────┘ └──────┘ └────────┘
                                       │
                                       ▼
                              ┌────────────────┐
                              │ Azure OpenAI   │
                              │ + Foundry agts │
                              └────────────────┘
```

> **Pluggable providers:** Storage (Cloudflare R2 / disk), Queue (QStash / in-memory),
> LLM (Azure OpenAI / Azure AI Foundry / mock), and Cache (Upstash Redis / node-cache) are all selected via env.

## 📦 Monorepo Structure (npm Workspaces + Turborepo)

```text
smart-apply/
├── package.json              # Workspace root
├── turbo.json                # Turborepo pipeline
├── apps/
│   ├── api/                  # @smart-apply/api (NestJS 11)
│   │   ├── src/
│   │   │   ├── admin/             # Admin dashboard endpoints
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
│   │   │   ├── linkedin-jobs/     # LinkedIn job search
│   │   │   ├── llm/               # LLM provider abstraction
│   │   │   ├── logger/            # Pino + Winston audit
│   │   │   ├── pdf/               # Puppeteer + Handlebars (50 templates)
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
│ PDF Service (Puppeteer pool)         │
│ 1. Render Handlebars template        │
│ 2. Generate ATS-optimized PDFs       │
│ 3. Apply pdf-lib post-processing     │
└──────────────────────────────────────┘
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
| Database    | PostgreSQL 16                                        |
| ORM         | Prisma 6.19 (`@prisma/adapter-pg` + connection pool) |
| Auth        | passport-jwt · passport-google · passport-microsoft · passport-azure-ad · argon2 · otplib (2FA) |
| Queue       | Upstash QStash · in-memory                           |
| Cache       | Upstash Redis · node-cache                           |
| Storage     | Cloudflare R2 (S3-compatible) · local disk           |
| LLM         | Azure AI Foundry · Azure OpenAI · mock               |
| PDF         | Puppeteer 24 + Playwright · Handlebars · pdf-lib · pdf-parse · mammoth (DOCX) |
| Email       | Resend                                               |
| Logging     | Pino (req logs) + Winston (audit, daily rotation)    |
| Monitoring  | Sentry (`@sentry/node` + profiling)                  |
| Validation  | class-validator · Zod · sanitize-html                |
| Resilience  | opossum (circuit breaker) · generic-pool (browser pool) |
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
| Container  | Docker (multi-stage)                          |
| API host   | Azure Container Apps                          |
| Web host   | Cloudflare Workers via `@opennextjs/cloudflare` |
| Registry   | Azure Container Registry (ACR)                |
| CI/CD      | GitHub Actions + Azure OIDC                   |
| Secrets    | Azure Key Vault (prod) · `.env` (dev)         |
| Database   | Azure Database for PostgreSQL Flexible Server |
| DNS/CDN    | Cloudflare                                    |

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
| GET      | `/linkedin-jobs/search`        | LinkedIn job search      |
| GET/POST | `/applications`                | Application pipeline     |
| GET      | `/applications/:id/files`      | SAS download URLs        |
| GET      | `/applications/:id/stream`     | SSE status stream        |
| POST     | `/interviews`                  | Generate mock interview  |
| GET      | `/templates`                   | Template catalog         |
| GET      | `/sessions`                    | Active sessions          |
| DELETE   | `/sessions/:id`                | Remote logout            |
| GET      | `/subscription`                | Plan & usage             |
| GET/PUT  | `/user-preferences`            | Settings                 |

## 🚀 Deployment

### Development

```bash
npm run dev          # API + Web in parallel (Turborepo)
npm run api:dev      # NestJS on :3000
npm run web:dev      # Next.js on :3001
```

### Production

```text
GitHub Actions
  ├── Build & test (Turborepo cache)
  ├── Build Docker image (apps/api) → push to ACR
  └── Deploy
       ├── API → Azure Container Apps (rolling, OIDC)
       │        └─ env from Azure Key Vault
       │        └─ Postgres Flexible · Blob · Service Bus
       └── Web → Cloudflare Workers (OpenNext)
                └─ wrangler deploy
```

## 📈 Performance & Resilience

| Feature             | Implementation                              |
| ------------------- | ------------------------------------------- |
| **Template cache**  | In-memory cache (TTL)                       |
| **Browser pool**    | Puppeteer instance pool (`generic-pool`)    |
| **Circuit breaker** | `opossum` around LLM calls                  |
| **DB indexes**      | Targeted indexes; cursor-based pagination   |
| **Compression**     | gzip middleware                             |
| **Soft delete**     | Logical deletion across user data           |
| **SSE**             | Real-time pipeline status                   |
| **N+1 prevention**  | Prisma `include`/select tuning              |
| **CDN**             | Cloudflare in front of Workers              |

---

See [docs/](docs/) for feature specs, security notes, and implementation guides.
