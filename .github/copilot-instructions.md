# Smart Apply — Full-Stack MVP (Azure)

## Goal
Deliver a production-grade, multi-provider application with:
1) **Frontend (Next.js 16 + React 19)**: Auth (email/password + OAuth + 2FA), profile management, job-posting ingestion, application dashboard with PDF preview/editing, deployed to **Cloudflare Workers** via OpenNext.
2) **Backend API (NestJS 11)**: Candidate profile (skills, experiences, education, certificates, projects, languages), ingests job postings (text/URL/file → normalized), generates tailored cover letter + resume on Azure OpenAI / mock.
3) **PDF Generation**: `@react-pdf/renderer` (TSX templates, 50 variants, ATS-optimized), stored via pluggable storage (Cloudflare R2 / disk) and retrieved via signed URLs.

## Agent Instructions
For specific tasks, refer to these specialized instruction files:
- **PDF Templates**: See `apps/api/src/pdf/templates/.copilot-instructions.md` for creating/modifying resume and cover letter templates
- **Template Agent**: See `apps/api/src/pdf/templates/AGENT.md` for the template creation agent workflow

## Documentation Sync (MANDATORY)
**Whenever the architecture changes, you MUST update both `README.md` and `ARCHITECTURE.md` in the same change set.** This includes (but is not limited to):
- Adding/removing/renaming a backend module or frontend route group
- Adding/removing a Prisma model or significant schema change
- Adding/changing a pluggable provider (`STORAGE_DRIVER`, `JOBS_DRIVER`, `LLM_PROVIDER`, cache, email)
- Changing the application generation pipeline (LLM orchestration, PDF, queueing, SSE)
- Adding/removing third-party services (Sentry, Resend, Upstash, Cloudflare, Azure resources)
- Major dependency upgrades that affect the stack (Next.js, NestJS, Prisma, React, Tailwind)
- New auth flows (OAuth providers, 2FA, refresh-token strategy, sessions)
- New API endpoints or breaking changes to existing ones
- Deployment topology changes (Fly.io, Cloudflare Workers, CI/CD pipelines)

Also update this `copilot-instructions.md` file (Tech Stack, Backend Modules, Data Model, API Endpoints, Env Variables sections) to keep agent context accurate. Treat doc drift as a bug — never ship architecture changes without the corresponding doc updates.

## Domain-Agnostic Design Principles
**Smart Apply is designed to work across ALL professions and industries**, not just IT/tech roles. When writing code, documentation, or examples:
- ✅ **Use diverse profession examples**: Healthcare (Nurse, Doctor), Manufacturing (CNC Operator), Marketing (Content Manager), Sales (Account Executive), Education (Teacher), Finance (Financial Analyst)
- ✅ **Generic terminology**: "Skills" (not "Technical Skills"), "Experience" (not "Development Experience"), "Projects" (not "Software Projects")
- ✅ **Domain-neutral placeholders**: "z.B. Projektmanager, Krankenpfleger, Vertriebsleiter" (not "z.B. Senior Software Engineer")
- ✅ **Inclusive skill categories**: "Core Competencies", "Technical Skills", "Methodologies", "Soft Skills" (not just programming languages/frameworks)
- ❌ **Avoid IT-centric bias**: Don't default to React/TypeScript/Cloud examples in user-facing content

## Repository Conventions & DevOps Discipline

**Read this section before generating ANY change.** These rules are not suggestions — they encode how the repo is actually run. See [CONTRIBUTING.md](../CONTRIBUTING.md) for the human-facing version.

### Branching model
- **Trunk-based** — there is one long-lived branch: `main`. Never propose adding `develop`, `staging`, `release/*`, or other long-lived branches.
- All work happens on **short-lived feature branches** (hours to 2 days max).
- Branch naming: `feat/<thing>` · `fix/<thing>` · `chore/<thing>` · `docs/<thing>` · `ci/<thing>` · `test/<thing>`.

### Commit messages
- **Always use [Conventional Commits](https://www.conventionalcommits.org/)**. `release-please` parses these to bump SemVer + generate the CHANGELOG.
- Format: `<type>(<scope>): <summary>` — e.g. `feat(profile): add languages section`, `fix(auth): refresh token race`.
- `feat:` → minor bump, `fix:` → patch, `feat!:` or `BREAKING CHANGE:` footer → major.
- `chore:`, `docs:`, `ci:`, `refactor:`, `test:`, `perf:` — no version bump but appear in CHANGELOG.
- Squash-merge collapses all commits into one — the **PR title** must follow the same format.
- **NEVER** suggest commits like `wip`, `update`, `fixed bug`, or grab-bag PRs covering multiple concerns.

### PR + merge flow
- All changes go through a PR — **never** propose `git push origin main` or any direct push to `main`.
- CI ([`.github/workflows/ci.yml`](../.github/workflows/ci.yml)) runs on every PR: lint + lockfile sync + unit tests (currently non-blocking) + per-PR Neon migration dry-run (only when schema changes).
- Wait for green checks before merging. Always **squash-merge**, never merge-commit (linear history is required for `release-please`).
- Delete the branch after merge.
- **NEVER** propose `git push --force` or `--no-verify` to main.

### Deployment flow
This project has **two environments** wired up:
- **Staging** (`smart-apply-api-staging.fly.dev` + `smart-apply-web-staging.ari41dev.workers.dev`) — auto-deploys on every push to `main` via [`deploy-staging.yml`](../.github/workflows/deploy-staging.yml). No approval gate.
- **Prod** (`api.smart-apply.io` + `smart-apply.io`) — deploys only on `v*.*.*` tag pushes via [`deploy-prod.yml`](../.github/workflows/deploy-prod.yml). Tags are created by `release-please` when its Release PR is merged. Gated by the `production` GitHub Environment (manual approval).

Resulting flow: PR → merge to main → staging deploys + Release PR opens/updates → you merge the Release PR → tag pushed via PAT → prod deploys after approval click.

### When you change `apps/api/prisma/schema.prisma`
- **Generate a migration** with `npx prisma migrate dev --name <descriptive_name>` — commit the resulting `migration.sql`.
- Migrations are **forward-only** — we don't write `down` migrations. Rollback is via Neon point-in-time-restore. See [docs/security/MIGRATION_ROLLBACK.md](../docs/security/MIGRATION_ROLLBACK.md).
- For destructive changes (DROP, RENAME, type change), use **expand → migrate → contract** across two releases. Never DROP a column in the same release as the code that stopped using it.
- **NEVER** suggest `prisma migrate reset` for any environment other than your local dev DB.

### When you change `package.json`
- Run `pnpm install` immediately after, and commit the resulting `pnpm-lock.yaml` change in the same PR. The `lint-and-typecheck` CI job blocks on lockfile drift (`pnpm install --lockfile-only` against the manifests must produce no diff against the committed lockfile).
- For dependency upgrades: minor/patch bumps are handled by Dependabot's grouped weekly PRs. Major bumps for `next`, `react`, `react-dom`, `prisma`, `@prisma/*`, `@nestjs/*`, `puppeteer`, `playwright`, `tailwindcss`, `typescript`, `turbo`, `lucide-react`, `eslint`, `eslint-config-next`, `@types/node` are **explicitly ignored** in [`.github/dependabot.yml`](../.github/dependabot.yml) — those need a deliberate, hand-tested PR.

### When architecture changes
- **MANDATORY**: update `README.md` + `ARCHITECTURE.md` in the same PR. See "Documentation Sync" above.
- If you change [`fly.prod.toml`](../fly.prod.toml) / [`fly.staging.toml`](../fly.staging.toml), env defaults, or pluggable provider behavior — also update this file's Tech Stack / Env Variables sections.
- If you add a new secret — add it to `apps/api/.env.example` (placeholder), document the local source in [docs/security/SECRETS_ROTATION.md](../docs/security/SECRETS_ROTATION.md), and tell the user to set it via `fly secrets set --app smart-apply-api[-staging]`.

### Secrets handling
- **Never** commit secrets. `.env`, `.env.local`, `*-secrets.env`, and `*.bak` are all gitignored.
- Local development reads from `apps/api/.env` (gitignored) and `apps/web/.env` (gitignored).
- Staging + prod read secrets from **Fly Secrets** (`flyctl secrets set --app <app>`) and **Cloudflare Worker secrets** (`wrangler secret put`) — never from a committed file.
- See [docs/security/SECRETS_ROTATION.md](../docs/security/SECRETS_ROTATION.md) for rotation procedures (10 secret types covered).

### Code style
- TypeScript strict mode is on. **Never** use `any` to silence the compiler — use `unknown` + a type guard.
- Don't add docstrings, comments, or annotations to code you didn't change.
- Backend: validate DTOs with `class-validator` (`whitelist: true, forbidNonWhitelisted: true` on the controller pipe). Sanitize string inputs from users with the existing `@Sanitize()` decorator.
- Frontend: App Router only (no Pages Router). Server components by default; mark client with `'use client'`. Forms use `react-hook-form` + Zod. Server state via TanStack Query with the existing `apiClient` wrapper — no raw `fetch()` in components. UI from shadcn/ui (`npx shadcn@latest add <name>`).

### Lint policy
- **New code MUST land with 0 ESLint errors AND 0 ESLint warnings.** CI's `lint-and-typecheck` job currently fails on errors only, but warnings accumulate into untracked tech debt — historically one reached 74 warnings before a single new error tipped the build red and blocked every PR. Treat warnings as errors for anything you author.
- Before opening a PR that touches `apps/web` or `apps/api`, run `pnpm lint` from the affected workspace and confirm a clean exit. If you add a file, lint that file.
- Don't introduce unused imports, unused locals, or unused parameters. If a parameter is required by a signature you don't control (route handlers, callback shapes), prefix it with `_` — `eslint.config.mjs` ignores leading-underscore identifiers project-wide.
- Don't suppress with `eslint-disable` unless the suppression is *behaviour-correct* (e.g. SSE effect that depends on `application?.status` not the whole `application` to avoid stream thrash). Always add a comment on the line above the disable explaining why the rule's auto-fix would break behaviour.
- If you introduce a deliberately-unused identifier (e.g. a destructured prop kept for API compat), prefix with `_` rather than disabling the rule.
- The frontend uses the React Compiler. **Never** call `form.watch(...)` from `react-hook-form` inside a component — use `useWatch({ control, name })` instead. The bare `watch()` returns an unstable function ref and trips `react-hooks/incompatible-library`, which silently disables memoisation for the whole component.

### Test suite status
- The existing unit tests (`apps/api/test/unit/**`) are **out of sync with the codebase**. CI marks `unit-tests` as `continue-on-error: true` so failures don't block PRs.
- E2E tests (`apps/api/test/e2e/**`) work but require a real DB — not run in CI.
- When adding new functionality, **don't be required to add new tests** to match — the test infrastructure debt is explicit. If you do write tests, make them small and focused.

### Things to never propose
- Direct `git push origin main` or `--force` to main
- Commits without a Conventional Commit prefix
- `prisma migrate reset` against any non-local DB
- DROP/RENAME column in the same release as the code change
- Adding a `staging`, `develop`, `release/*`, or `hotfix/*` long-lived branch
- Bypassing `@Sanitize()`, DTO whitelist, or JWT guards without explicit justification in the PR description
- Catch-and-ignore error handling (`try { ... } catch {}`)
- Lockfile changes without the matching `package.json` change in the same PR (or vice versa)
- Adding to `node_modules/` directly, or hand-editing `pnpm-lock.yaml`
- Pasting real secrets in PR descriptions, issue comments, or chat
- Shipping new code that introduces ESLint errors *or* warnings (see Lint policy)
- `form.watch(...)` inside a component body — use `useWatch({ control, name })`

## Non-Goals
- Rich document editing beyond Tiptap StarterKit
- Multi-tenant org hierarchy (single-tenant users/subscriptions for MVP)
- Native mobile app (responsive web only)

## Tech Stack

### Monorepo
- **pnpm workspaces** (`pnpm-workspace.yaml`) + **Turborepo 2.8** (`apps/api`, `apps/web`, `packages/shared`)
- Node **24** (>= 20.19), TypeScript 5.9 strict

### Backend (`apps/api`, Port 3000)
- **NestJS 11** (TypeScript)
- **Prisma 6.19** with `@prisma/adapter-pg` 7.3 (PrismaPg + connection pool)
  - Schema in `apps/api/prisma/schema.prisma`; client generated via `prisma.config.ts`
  - Dev/Prod: **Neon Postgres** (serverless, EU/Frankfurt for GDPR). Two URLs:
    - `DATABASE_URL` — **pooled** (pgbouncer hostname contains `-pooler`); used by the runtime PrismaService
    - `DIRECT_URL` — **unpooled**; used by the Prisma CLI for migrations & seed (transaction-mode poolers don't support Prisma Migrate)
  - Local fallback: Docker Postgres 16 (`infra/docker-compose.yml`); CLI falls back to `DATABASE_URL` when `DIRECT_URL` is unset
- **Auth:** passport-jwt, passport-google-oauth20, passport-microsoft, passport-azure-ad, argon2id, **otplib + qrcode + speakeasy** (TOTP 2FA)
- **Refresh tokens:** dual-token rotation, device tracking, max 5/user
- **Sessions:** multi-device, IP/UA, remote logout, cron cleanup
- **Storage (pluggable via `STORAGE_DRIVER`):** `disk` | `r2` (`@aws-sdk/client-s3`). Boot refuses to start when `NODE_ENV=production` and the driver isn't `r2`.
- **Queue (pluggable via `JOBS_DRIVER`):** `in-memory` | `qstash` (`@upstash/qstash`). Boot refuses to start when `NODE_ENV=production` and the driver isn't `qstash`.
- **Cache:** Upstash Redis (`@upstash/redis`) + `node-cache`
- **LLM (pluggable via `LLM_PROVIDER`):** `azure-openai` | `azure-ai-foundry` | `mock`
  - Direct Azure OpenAI HTTP calls (`@nestjs/axios`)
  - Azure AI Foundry agents (`@azure/ai-agents`) for ATS keyword extraction, CV/CL writing
  - **opossum** circuit breaker around LLM calls
- **PDF:**
  - `@react-pdf/renderer` 4.5 (TSX templates under `src/pdf-v2/templates/*`) — the **sole** PDF renderer. ESM-only; loaded lazily via `react-pdf-loader.ts` because the api package is CommonJS. Puppeteer + Handlebars were removed in v1.16.
  - Template **PNG previews** via `pdfjs-dist` 4.10 + `@napi-rs/canvas` 0.1 in `pdf-v2/preview-renderer.service.ts` — renders sample data through react-pdf, then rasterises page 1 with pdfjs onto a napi-rs canvas. No browser, no Chromium dependency.
  - Resume parsing intake: `pdf-parse` (PDF text) + `mammoth` (DOCX text).
  - Currently registered TSX designs: `classic-ats`, `harvard-classic`, `elegant-sidebar` (all 5 color variants resolve via single factory + DB `accentColor`). Templates without a registered factory cause `PdfService` to throw — there is no fallback path.
- **Email:** Resend (`resend`) for transactional mail
- **Logging:** Pino (request logs) + Winston with daily rotation (audit, 90-day retention)
- **Monitoring:** Sentry (`@sentry/node` + `@sentry/profiling-node`)
- **Security:** Helmet, CORS whitelist, `@nestjs/throttler` 6.5 (dual-tier), `csrf-csrf` 4.0 (optional), `sanitize-html`, `isomorphic-dompurify`, `@Sanitize()` decorator
- **Health:** `@nestjs/terminus` (`/health`)
- **Scheduling:** `@nestjs/schedule` for cron jobs (session cleanup, etc.)
- **Containers:** Docker (multi-stage, `infra/Dockerfile`); deploy to **Fly.io** (`smart-apply-api`, region `fra`)

### Frontend (`apps/web`, Port 3001)
- **Next.js 16.1** (App Router, Server Components, React Compiler)
- **React 19.2** with TypeScript strict
- **Tailwind CSS v4** + PostCSS
- **shadcn/ui** (Radix primitives) + lucide-react icons
- **State:**
  - Zustand **5.0** (auth store)
  - **TanStack Query 5.90** (server state, caching, optimistic updates)
- **Forms:** react-hook-form 7.66 + Zod 3.25 (`@hookform/resolvers`)
- **PDF:** react-pdf 10 + pdfjs-dist 5
- **Editor:** Tiptap 3.10 (StarterKit + TextStyle)
- **Sanitization:** isomorphic-dompurify
- **Files:** react-dropzone, jszip
- **Markdown:** marked, turndown
- **Toast:** sonner
- **Deployment:** **Cloudflare Workers** via `@opennextjs/cloudflare` 1.19 + `wrangler` 4.85

## Backend Modules (`apps/api/src/`)
- `admin` — allow-listed admin endpoints (gated by `ADMIN_EMAILS` env), e.g. `POST /admin/users/:email/tier`, `DELETE /admin/users/:email`
- `agents` — Azure AI Foundry agents (URL parsing, etc.)
- `applications` — generation pipeline (profile + job → LLM → PDF → storage), SSE status stream
- `auth` — JWT, refresh-token rotation, OAuth (Google/Microsoft/Azure AD), TOTP 2FA, password reset
- `common` — guards, filters, decorators (`@Sanitize()`)
- `config` — Zod env schema
- `contact` — contact form
- `email` — Resend transactional email
- `health` — Terminus health checks
- `interviews` — AI mock-interview Q&A generator
- `job-postings` — parse text/URL/file → normalized JobPosting
- `jobs` — pluggable queue providers (`in-memory` | `qstash`)
- `keywords` — ATS keyword extraction & matching with language detection
- `linkedin-jobs` — LinkedIn job search via Apify scraper (Premium-only single-source endpoint, kept for backward compat)
- `job-search` — **Pluggable multi-source job search** (`JobSearchProvider` interface). Concrete providers: `linkedin` (Premium, wraps `linkedin-jobs`) and `arbeitnow` (free, German-first public API). Fan-out by default; per-source try/catch; cross-source dedup by `(title, company)`. Add new sources by implementing `JobSearchProvider` and binding under `JOB_SEARCH_PROVIDERS` in `JobSearchModule`.
- `llm` — pluggable providers (`azure-openai` | `azure-ai-foundry` | `mock`) with automatic language detection, opossum circuit breaker
- `logger` — Pino + Winston audit logger
- `mailbox-sync` — **Email Tracking (Premium)**: OAuth inbox sync (Microsoft Graph; Gmail planned). Detects company replies in the user's inbox, classifies them with the LLM, and updates the matching `Application.applicationStatus` automatically. Encrypts refresh tokens at rest (AES-256-GCM, `MAILBOX_TOKEN_ENCRYPTION_KEY`). No email bodies are persisted — only metadata + classification.
- `pdf` — thin façade over `pdf-v2/ReactPdfRendererService`. Kept so external callers (`application.processor.ts`, tests) preserve the `PdfService` API surface. Throws when a template has no react-pdf factory registered.
- `pdf-v2` — the active PDF subsystem. Owns `ReactPdfRendererService` (TSX → PDF buffer), `PreviewRendererService` (PDF → PNG via `pdfjs-dist` + `@napi-rs/canvas`), the template registry, and the shared template-data types. See [`.github/skills/pdf-react-pdf-template.md`](./skills/pdf-react-pdf-template.md) for the porting recipe. Quick standalone check: `npx ts-node -r tsconfig-paths/register scripts/validate-react-pdf-templates.ts`.
- `prisma` — PrismaService
- `profile` — CRUD with **differential updates** (Skills, Experiences, Education, Certificates, Projects, Languages)
- `resume-parser` — PDF/DOCX → Profile bootstrap (pdf-parse + mammoth)
- `storage` — pluggable providers (`disk` | `r2`)
- `subscription` — plans & usage limits
- `templates` — template catalog
- `uploads` — file uploads
- `user-preferences` — per-user settings

## Frontend Structure
- `app/` (App Router with route groups)
  - `(auth)/` - Login, Register pages
  - `(dashboard)/` - Profile, Job Postings, Applications, PDF Preview
  - `page.tsx` - Landing page
- `components/`
  - `ui/` - shadcn/ui components
  - `forms/` - Custom form components
  - `pdf/` - PDF preview & editing components
- `lib/`
  - `api-client.ts` - Typed fetch wrapper for backend API
  - `providers.tsx` - React Query & Toaster providers
  - `utils.ts` - Helper functions (cn, formatDate, truncate)
- `stores/`
  - `auth-store.ts` - Zustand store (user, token, isAuthenticated)
- `hooks/`
  - `use-profile.ts` - Profile data fetching & mutations
  - `use-applications.ts` - Applications data fetching & mutations
- `types/`
  - `index.ts` - TypeScript types (User, Profile, JobPosting, Application)

## Data Model (Prisma 6)
16 models in `apps/api/prisma/schema.prisma`:
- **User**, **Profile**, **Skill**, **Experience**, **Education**, **Certificate**, **Project**, **Language**
- **JobPosting**, **Application**, **ResumeTemplate**, **Interview**
- **RefreshToken**, **Session** (auth/security)
- **Subscription** (plans & usage)
- **AuditLog** (security events)
- **MailboxConnection**, **ApplicationEmailEvent** (email tracking — Premium)

## API Endpoints (v1)

All endpoints are prefixed with `/api/v1` and documented at `http://localhost:3000/docs` (Swagger UI).

### Authentication Endpoints (Public)

**POST /api/v1/auth/register**
- Register new user with email/password (argon2id hashed)
- Rate limit: 5 attempts / 15 minutes (strict)
- Sets HttpOnly cookies: `access_token` (~15 min) + `refresh_token` (7 days, rotated)
- Returns: `{ user: { id, email, firstName, lastName } }`

**POST /api/v1/auth/login**
- Login with email/password (TOTP challenge if 2FA enabled)
- Rate limit: 5 attempts / 15 minutes (strict)
- Sets HttpOnly cookies: `access_token` + `refresh_token`
- Returns: `{ user: { id, email, firstName, lastName }, requires2FA?: true }`

**POST /api/v1/auth/refresh**
- Rotate refresh token → new access + refresh cookies
- Reuse of an already-used refresh token revokes the entire session chain

**GET /api/v1/auth/oauth/google**, **/auth/oauth/microsoft**, **/auth/oauth/azure-ad**
- OAuth 2.0 login flows; on success sets the same auth cookies

**POST /api/v1/auth/password-reset/request** / **/password-reset/confirm**
- Email-based password reset (Resend)

**GET /api/v1/auth/csrf-token**
- Get CSRF token for state-changing requests (optional, only if `ENABLE_CSRF=true`)
- Rate limit: 100 requests / 15 minutes (default, NOT strict auth limit)
- Returns: `{ csrfToken: string, message: string }`
- Frontend auto-fetches and includes in X-CSRF-Token header

**GET /api/v1/auth/me**
- Get current authenticated user details
- Protected: Requires JWT in HttpOnly cookie
- Returns: `{ id, email, firstName, lastName, emailVerified, provider, hasPassword }`
- `hasPassword=false` indicates an OAuth-only account (Google/Microsoft sign-in user who never set a local password) — the frontend uses this to swap the password-confirm prompt for an email-typed confirmation in the "delete account" / "change password" flows.

**GET /api/v1/auth/logout**
- Logout user (clear auth cookies, revoke refresh token)
- Protected: Requires JWT in HttpOnly cookie
- Returns: `{ message: "Logged out successfully" }`
- Note: GET to avoid CSRF validation

**POST /api/v1/auth/2fa/setup** / **/2fa/verify** / **/2fa/disable**
- TOTP enrollment (returns QR), verification, and disable flows (otplib)

### Resume Parser (Protected)

**POST /api/v1/resume-parser/parse**
- Upload PDF/DOCX → extract structured profile data (pdf-parse + mammoth + LLM)
- Returns: parsed profile suggestion (user reviews before saving)

### Sessions (Protected)

**GET /api/v1/sessions** — list active sessions (device, IP, geolocation)
**DELETE /api/v1/sessions/:id** — remote logout for a specific session

### Subscription (Protected)

**GET /api/v1/subscription** — current plan + usage counters

### Admin (Protected, allow-listed)

Gated by `ADMIN_EMAILS` (comma-separated, case-insensitive). Returns 403 when the env var is empty or the caller's email isn't listed.

**GET /api/v1/admin/users?email=<query>** — search users by partial email (case-insensitive, max 20 results)
**POST /api/v1/admin/users/:email/tier** — set a user's subscription tier and reset the billing period
  - Body: `{ "tier": "FREE" | "PREMIUM" | "PREMIUM_PLUS", "periodMonths"?: number (1–120, default 12) }`
  - Idempotent; `:email` matched case-insensitively
  - Replaces the old `flyctl ssh` + `node /app/promote-premium.js` workflow
**DELETE /api/v1/admin/users/:email** — permanently delete a user account (admin override; no password confirmation)
  - Use case: OAuth-only users (e.g. "Sign in with Google") who never set a password and can't complete the self-service deletion flow on their own — or any support-driven account removal.
  - Cascades through Prisma `onDelete: Cascade` (Profile, Applications, JobPostings, Sessions, RefreshTokens, OAuthProviders, MailboxConnections). Stored PDFs in R2/disk are NOT deleted here — same trade-off as the user-facing `AuthService.deleteAccount`.
  - `:email` matched case-insensitively. Returns 404 if the account is already gone.

### User Preferences (Protected)

**GET/PUT /api/v1/user-preferences** — per-user settings

### Interviews (Protected)

**POST /api/v1/interviews** — generate AI mock-interview Q&A for a job posting
**GET /api/v1/interviews/:id** — fetch saved interview

### LinkedIn Jobs (Protected, legacy single-source)

**GET /api/v1/linkedin-jobs/search** — search LinkedIn job postings via Apify (Premium). Kept for backward compatibility with the existing frontend; new clients should prefer the unified `/job-search` endpoints below.

### Unified Job Search (Protected)

Pluggable multi-source endpoints. Source implementations live in `apps/api/src/job-search/providers/` and are picked up by the `JobSearchService` registry via the `JOB_SEARCH_PROVIDERS` DI token — mirrors the same pattern used for `STORAGE_DRIVER`, `LLM_PROVIDER`, `JOBS_DRIVER`.

**GET /api/v1/job-search/sources** — list configured providers + per-tier availability so the frontend can render the "Search in:" picker accurately.

**POST /api/v1/job-search** — fan-out search across all configured providers. Body: `{ keywords?, location?, country?, remoteOnly?, sources?: ('linkedin'|'arbeitnow')[], perSourceLimit? }`. Returns `{ results, totalCount, sources, searchedAt }` where `sources[]` reports `ok | skipped | error` per provider so partial failures stay visible. Throttled to 30/hour per user.

**POST /api/v1/job-search/import** — persist a `UnifiedJobDto` as a JobPosting via its originating provider. Throttled to 60/hour. 403 if the source requires Premium and the caller isn't on Premium.

Provider gating:
- `arbeitnow` — free public API (`https://www.arbeitnow.com/api/job-board-api`), no auth, German-first corpus, **available to FREE tier**.
- `linkedin` — Apify-backed (`APIFY_TOKEN` required), **Premium-only**, costs ~€0.01–0.05 per search.

### Email Tracking — Inbox Sync (Premium)

All endpoints under `/api/v1/mailbox-sync/*` are gated by `@RequiresFeature('emailParsing')` (Premium tier) **except** the public `microsoft/callback` and `microsoft/webhook` routes.

**GET /api/v1/mailbox-sync/connections** — list the user's connected mailboxes
**GET /api/v1/mailbox-sync/microsoft/connect** — returns `{ authorizationUrl }` to redirect the browser to Microsoft consent
**GET /api/v1/mailbox-sync/microsoft/callback** — public OAuth redirect target; persists the connection and redirects to `${APP_URL}/settings?email_tracking=connected`
**DELETE /api/v1/mailbox-sync/connections/:id** — disconnect mailbox + revoke Graph subscription
**POST /api/v1/mailbox-sync/microsoft/webhook** — public Microsoft Graph push-notification endpoint (validation handshake + change notifications). Verified per-connection via `clientState`. Returns 202 immediately and processes asynchronously. Daily cron renews subscriptions before their ~70.5h Graph cap expires.

### Templates (Protected)

**GET /api/v1/templates** — list available PDF templates (50 variants, by language × design)

### Profile Endpoints (Protected)

**GET /api/v1/profile**
- Get complete profile with all nested relations
- Returns: Full profile object including skills, experiences, education, certificates, projects arrays
- Note: Auto-created on user registration, returns 404 if missing

**PUT /api/v1/profile**
- Update profile with differential updates for nested collections
- Body: Partial update with any combination of basic fields + arrays
- Nested arrays support upsert pattern:
  - Items WITH `id`: Update existing item
  - Items WITHOUT `id`: Create new item
  - Items NOT in array: Delete (orphan removal)
  - Empty array `[]`: Delete all items in collection
- All string inputs sanitized with `@Sanitize()` decorator (XSS protection)
- Returns: Complete updated profile

**IMPORTANT:** Profile uses differential update pattern. No separate POST/DELETE endpoints for nested entities.
Example: To add a skill, include it in `skills` array without `id`. To update, include `id`. To delete, omit from array.

### Job Postings Endpoints (Protected)

**POST /api/v1/job-postings/parse**
- Parse job posting from text, URL, or file
- Body: `{ text?, url?, fileKey? }` (exactly one required)
- Returns: Normalized job posting with title, company, location, description, requirements, etc.
- Note: Currently stores as-is, parsing logic TODO

**GET /api/v1/job-postings**
- List all job postings for current user
- Returns: Array of job posting objects (sorted by createdAt desc)

**GET /api/v1/job-postings/:id**
- Get single job posting by ID
- Returns: Job posting object or 404 if not found/unauthorized

**DELETE /api/v1/job-postings/:id**
- Delete job posting (cascade deletes related applications)
- Returns: 204 No Content

### Applications Endpoints (Protected)

**POST /api/v1/applications**
- Create application and trigger background processing pipeline
- Body: `{ jobPostingId, notes? }`
- Returns: `{ id, status: "PENDING", ... }` (initial status)
- Pipeline: PENDING → GENERATING → READY (or FAILED)
  1. Load profile + job posting
  2. Render LLM prompts with data
  3. Call Azure OpenAI (or mock provider)
  4. Generate PDFs with @react-pdf/renderer
  5. Upload to Azure Blob Storage
  6. Update status to READY

**GET /api/v1/applications**
- List all applications for current user
- Query: `?includeJobPosting=true` (optional, default: false)
- Returns: Array of application objects (sorted by createdAt desc)

**GET /api/v1/applications/:id**
- Get single application details
- Query: `?includeJobPosting=true` (optional, default: false)
- Returns: Application object or 404 if not found/unauthorized

**GET /api/v1/applications/:id/files**
- Get Azure Blob SAS URLs for downloading PDFs
- Returns: `{ coverLetterUrl, resumeUrl, expiresAt }` (1 hour expiry)
- Note: Returns 400 if status is not READY

**GET /api/v1/applications/:id/download/cover-letter**
- Direct download of cover letter PDF (alternative to SAS URLs)
- Returns: PDF file stream with Content-Disposition: attachment

**GET /api/v1/applications/:id/download/resume**
- Direct download of resume PDF (alternative to SAS URLs)
- Returns: PDF file stream with Content-Disposition: attachment

**GET /api/v1/applications/:id/stream**
- **SSE** stream of pipeline status updates (PENDING → GENERATING → READY/FAILED)

### Rate Limiting

- **Auth endpoints** (register, login): 5 attempts / 15 minutes (strict)
- **CSRF token endpoint**: 100 requests / 15 minutes (default, NOT strict)
- **All other endpoints**: 100 requests / 15 minutes (default)

### Error Format

All endpoints return consistent error structure:
```typescript
{
  statusCode: number,
  message: string | string[],
  error: string,
  code?: string  // e.g., "EBADCSRFTOKEN" for CSRF errors
}
```

Common codes: 400 (validation), 401 (unauthorized), 403 (CSRF/forbidden), 404 (not found), 429 (rate limit), 500 (server error)

## Backend Architecture Patterns

### Authentication Flow
1. User registers/logs in via POST /auth/register or /auth/login
2. Backend validates credentials, hashes password with argon2
3. JWT token generated and stored in **HttpOnly cookie** (`access_token`)
4. Frontend includes `credentials: 'include'` in all fetch requests
5. JwtStrategy extracts token from cookie (not Authorization header)
6. Token validated on every protected endpoint via `@UseGuards(JwtAuthGuard)`

### Profile Update Pattern (Differential Updates)
The profile endpoint uses a **differential update pattern** for nested collections:
- **Upsert:** Items with `id` field are updated, items without `id` are created
- **Delete:** Items not included in the array are deleted (orphan removal)
- **Clear All:** Empty array `[]` deletes all items in that collection
- **No Changes:** Omit the array entirely to keep existing items

Example: Update profile with new skill and remove old ones not in array:
```typescript
PUT /api/v1/profile
{
  summary: "Updated summary",
  skills: [
    { id: "existing-id", name: "JavaScript", level: "Expert" },  // Update existing
    { name: "TypeScript", level: "Advanced" }                    // Create new
    // Skills not in this array will be deleted (orphan removal)
  ]
}
```

### Application Pipeline
1. Load Profile + JobPosting; enforce subscription usage limits
2. Detect language (DE/EN), select template (lang × design), extract ATS keywords
3. Render prompt templates (`prompts/cover-letter.md`, `prompts/resume.md`)
4. Call LLM via provider abstraction wrapped in **opossum** circuit breaker → Markdown/HTML
5. TSX → PDF via `@react-pdf/renderer` (no browser, no post-processing)
6. Upload PDFs via storage provider (Blob/S3/disk); persist keys + signed URLs
7. Status: `PENDING → GENERATING → READY | FAILED` (pushed to client via **SSE**)
8. Background work via pluggable queue (`qstash` | `in-memory`)

## Prompt Templates
- **cover-letter.md**: concise, 1 page, intro → fit (3–5 bullets) → motivation → closing
- **resume.md**: prioritize relevant experience, quantify outcomes, highlight skill-match (≤ 2 pages)

## Validation & Errors
- DTO validation (class-validator or Zod)
- Central exception filter
- File type/size whitelist on upload
- LLM timeouts/retries; graceful fallback to mock in test

## Security & Compliance

### Current Security (9.5/10 Score)
**Implemented ✅**
- JWT authentication with JwtAuthGuard on all protected endpoints
- **JWT stored in HttpOnly cookies** (XSS-protected, no localStorage exposure)
- **Refresh token strategy** with rotation, device tracking, max 5 tokens/user
- **Session management** with multi-device tracking, remote logout, geolocation
- Password hashing with argon2 (memory-hard, ASIC-resistant)
- Helmet security headers (XSS, clickjacking, MIME sniffing protection)
- **Frontend security headers** (CSP, X-Frame-Options, HSTS, X-Content-Type-Options)
- CORS with configurable origins (restrictive whitelist)
- Dual-tier rate limiting:
  - Auth endpoints: 5 attempts / 15 minutes (strict)
  - Standard endpoints: 100 requests / 15 minutes
- Password strength validation (8+ chars, mixed case, number, special character)
- Strong JWT secret generation (64+ characters, cryptographically secure)
- Input validation with class-validator DTOs (whitelist + forbidNonWhitelisted)
- **Input sanitization** with @Sanitize() decorator and DOMPurify (XSS protection)
- **Audit logging** with Winston (daily rotation, 90-day retention, security events)
- User-friendly rate limit error messages in frontend
- No PII in logs

**Recently Implemented 🆕 (Issues #91-#98, #129, #144, #146)**
- ✅ **#91:** Strong JWT secret generation (openssl rand -base64 64)
- ✅ **#92:** Restrictive CORS policy with environment-based origins
- ✅ **#93:** HttpOnly cookies for JWT storage (XSS-protected token storage)
- ✅ **#94:** Password strength validation with regex enforcement
- ✅ **#95:** Strict rate limiting on auth endpoints (5/15min)
- ✅ **#96:** CSRF protection with csrf-csrf (optional, disabled by default)
- ✅ **#97:** Input sanitization with @Sanitize() decorator (XSS protection)
- ✅ **#98:** Refresh token strategy (dual-token, rotation, device tracking, max 5/user)
- ✅ **#129:** Audit logging (Winston, daily rotation, 90-day retention, security events)
- ✅ **#144:** Frontend security headers (CSP, X-Frame-Options, HSTS, X-Content-Type-Options)
- ✅ **#146:** Session management (multi-device tracking, remote logout, max 5 sessions, cron cleanup)
- 📝 **Security documentation:** CORS_SECURITY.md, SECURITY.md, XSS_PROTECTION.md, REFRESH_TOKENS.md with rotation procedures

**CSRF Protection Details (Issue #96):**
- **Package:** csrf-csrf (Double Submit Cookie Pattern)
- **Status:** Optional, disabled by default for MVP (`ENABLE_CSRF=false`)
- **Configuration:**
  - Development: `cookieName='csrf'`, `sameSite='lax'`, `secure=false` (HTTP localhost)
  - Production: `cookieName='__Host-csrf'`, `sameSite='strict'`, `secure=true` (HTTPS)
  - Ignored methods: GET, HEAD, OPTIONS
  - Token header: X-CSRF-Token (64 bytes)
- **Rate Limiting:** CSRF token endpoint uses default limit (100/15min), not strict auth limit
- **Frontend:** Automatic token fetch, injection, and refresh in api-client.ts
- **Logout:** Changed to GET method (no CSRF validation required)
- **Important:** `__Host-` cookie prefix only works with HTTPS (production)

**Completed Security Features ✅**
- JWT stored in HttpOnly cookies (Issue #93) - Enabled by default, XSS-protected
- Input sanitization with @Sanitize() decorator (Issue #97) - Enabled by default
- CSRF protection (Issue #96) - Optional, set `ENABLE_CSRF=true` to enable
- Refresh token strategy (Issue #98) - Dual-token rotation with device tracking
- Audit logging (Issue #129) - Winston with daily rotation, 90-day retention
- Frontend security headers (Issue #144) - CSP, X-Frame-Options, HSTS
- Session management (Issue #146) - Multi-device tracking, remote logout, max 5 sessions

**Shipped Since Original MVP ✅**
- ✅ **Two-factor authentication (2FA)** — TOTP via otplib + qrcode + speakeasy
- ✅ **OAuth login** — Google, Microsoft, Azure AD
- ✅ **Sentry monitoring** — `@sentry/node` + profiling
- ✅ **Refresh token rotation** with reuse-detection

**Future Enhancements 🟢 (Post-MVP)**
- **Azure Key Vault** for secrets in prod
- Short-TTL **SAS** for file downloads (15-minute expiry)
- GDPR-friendly deletion (data export + erase workflows)
- Enhanced audit logging (real-time alerts, SIEM integration)
- WebAuthn/passkeys

**Security Roadmap**
See [docs/guides/PUBLIC_LAUNCH_PLAN.md](../docs/guides/PUBLIC_LAUNCH_PLAN.md) for the active pre-launch checklist.

## Environment Variables

### Backend (`apps/api/.env`)
```bash
# Database (Neon Postgres — serverless, EU/Frankfurt for GDPR)
# Pooled connection (used by the app at runtime via PrismaPg adapter)
DATABASE_URL=postgresql://USER:PW@ep-xxx-pooler.<region>.aws.neon.tech/<db>?sslmode=require&channel_binding=require
# Direct (unpooled) connection — REQUIRED for `prisma migrate` / `prisma db seed`
# (transaction-mode poolers like pgbouncer don't support Prisma Migrate).
# Same hostname as DATABASE_URL but WITHOUT the `-pooler` suffix.
# Falls back to DATABASE_URL when unset (e.g. local Docker Postgres).
DIRECT_URL=postgresql://USER:PW@ep-xxx.<region>.aws.neon.tech/<db>?sslmode=require&channel_binding=require

# JWT (CRITICAL: openssl rand -base64 64)
JWT_SECRET=REPLACE_WITH_SECURE_RANDOM_SECRET_MINIMUM_64_CHARACTERS
JWT_REFRESH_SECRET=REPLACE_WITH_DIFFERENT_64_CHAR_SECRET

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:3001

# Rate Limiting
RATE_LIMIT_TTL=900           # 15 min
RATE_LIMIT_MAX=1000          # Standard endpoints (prod: 300-500)
RATE_LIMIT_AUTH_TTL=900
RATE_LIMIT_AUTH_MAX=5        # Auth endpoints (STRICT)

# CSRF (optional)
ENABLE_CSRF=false

# Storage (pluggable)
STORAGE_DRIVER=disk          # disk | r2 — NODE_ENV=production rejects 'disk'

# Cloudflare R2 (S3-compatible) — required when STORAGE_DRIVER=r2
# Use an EU-jurisdiction bucket + EU-scoped token for GDPR data residency.
R2_ACCOUNT_ID=<account-id>
R2_ACCESS_KEY_ID=<key>
R2_SECRET_ACCESS_KEY=<secret>
R2_BUCKET=smart-apply-prod
R2_ENDPOINT=https://<account-id>.eu.r2.cloudflarestorage.com

# Queue (pluggable)
JOBS_DRIVER=in-memory      # in-memory | qstash — NODE_ENV=production rejects 'in-memory'
QSTASH_TOKEN=<upstash-qstash-token>
QSTASH_CURRENT_SIGNING_KEY=<key>
QSTASH_NEXT_SIGNING_KEY=<key>

# Cache
UPSTASH_REDIS_REST_URL=<url>
UPSTASH_REDIS_REST_TOKEN=<token>

# LLM (pluggable)
LLM_PROVIDER=mock            # azure-openai | azure-ai-foundry | mock
AZURE_OPENAI_ENDPOINT=https://your-aoai.openai.azure.com/
AZURE_OPENAI_API_KEY=<key>
AZURE_OPENAI_DEPLOYMENT_NAME=<deployment>

# Azure AI Foundry (URL parsing agents)
AZURE_AI_FOUNDRY_ENDPOINT=<endpoint>
AZURE_AI_FOUNDRY_API_KEY=<key>

# OAuth
GOOGLE_CLIENT_ID=<id>
GOOGLE_CLIENT_SECRET=<secret>
MICROSOFT_CLIENT_ID=<id>
MICROSOFT_CLIENT_SECRET=<secret>
AZURE_AD_CLIENT_ID=<id>
AZURE_AD_CLIENT_SECRET=<secret>
AZURE_AD_TENANT_ID=<tenant>

# Email (Resend)
RESEND_API_KEY=<key>
RESEND_FROM=noreply@smartapply.com

# Cookie scope for cross-subdomain auth (prod/staging only — leave UNSET locally
# so cookies stay host-only on `localhost`). Without this, Chrome's tracking
# protection silently drops cookies between `<env>.smart-apply.io` and
# `api-<env>.smart-apply.io` and the user gets bounced back to login.
# Prod:    COOKIE_DOMAIN=.smart-apply.io
# Staging: COOKIE_DOMAIN=.smart-apply.io
COOKIE_DOMAIN=

# Monitoring (Sentry)
SENTRY_DSN=<dsn>
SENTRY_ENVIRONMENT=development

# Admin (comma-separated, case-insensitive). Leave empty to disable /admin/*.
ADMIN_EMAILS=you@example.com,coworker@example.com

# Email Tracking (Premium feature) — OAuth Inbox Sync
# AES-256-GCM key (32 bytes hex) for encrypting persisted refresh tokens.
# Generate with: openssl rand -hex 32
MAILBOX_TOKEN_ENCRYPTION_KEY=<64-hex-chars>
# SEPARATE Microsoft Entra app from the social-login one — needs delegated
# Mail.Read + offline_access scopes.
MS_GRAPH_CLIENT_ID=<id>
MS_GRAPH_CLIENT_SECRET=<secret>
MS_GRAPH_TENANT=common  # or a specific tenant id
# MS_GRAPH_POST_CONNECT_REDIRECT=<defaults to APP_URL/settings?email_tracking=connected>
# MAILBOX_SUBSCRIPTION_RENEWAL_MARGIN_MINUTES=360  # default 6h margin

# PDF Generation
# react-pdf has no env config of its own. PNG previews use pdfjs-dist +
# @napi-rs/canvas (no Chromium). Note: agent-url.parser.ts (Playwright)
# still needs CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser in Docker.
```

### Frontend (`apps/web/.env`)
```bash
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
NEXT_PUBLIC_TURNSTILE_SITE_KEY=<public CF Turnstile site key>
NEXT_PUBLIC_SENTRY_DSN=<public DSN, leave empty locally>
# Cloudflare Workers staging/prod set NEXT_PUBLIC_* via wrangler env.staging
# block + GitHub Actions build env (NOT this file).
```

> See [`apps/api/.env.example`](../apps/api/.env.example) and [`apps/web/.env.example`](../apps/web/.env.example) for the authoritative env-var list. The snippets in this file are illustrative — the example files are kept in sync with the actual schema.


## Local Dev Commands

### Initial Setup
```bash
# 0. Install pnpm via corepack (one-time, ships with Node 16.13+)
corepack enable && corepack prepare pnpm@11.1.2 --activate

# 1. Install workspaces
pnpm install

# 2. Local Postgres (or skip and use a Neon dev branch)
docker compose -f infra/docker-compose.yml up -d db

# 3. Per-app env files (root .env.example was removed)
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
# Edit apps/api/.env: paste real Azure OpenAI / OAuth / Resend keys.
# Defaults run fully offline (Docker Postgres, mock LLM, disk storage).

# 4. Migrate + seed
pnpm --filter @smart-apply/api prisma:migrate
pnpm --filter @smart-apply/api prisma:seed
pnpm --filter @smart-apply/api prisma:seed:templates

# 5. Run both apps in parallel (Turborepo)
pnpm dev
```

### Turborepo (root)
```bash
pnpm dev                 # API + Web in parallel
pnpm build               # Build all workspaces
pnpm lint                # Lint all workspaces
pnpm test                # Test all workspaces
```

### Backend (Terminal 1)
```bash
cd apps/api
pnpm start:dev           # NestJS at http://localhost:3000
pnpm test:e2e            # E2E tests
pnpm prisma:studio       # Prisma Studio GUI
pnpm prisma:migrate      # Run migrations
```

### Frontend (Terminal 2)
```bash
cd apps/web
pnpm dev                 # Next.js at http://localhost:3001
pnpm build               # Production build (validates TS)
pnpm lint                # ESLint check
pnpm cf:preview          # Local Cloudflare Workers preview (OpenNext)
pnpm cf:deploy           # Deploy to Cloudflare Workers
pnpm dlx shadcn@latest add <component>  # Add shadcn/ui component
```

### Access URLs
- **Frontend:** http://localhost:3001
- **Backend API:** http://localhost:3000
- **Swagger Docs:** http://localhost:3000/docs
- **Prisma Studio:** http://localhost:5555

### Demo Login
- **Email:** demo@smartapply.com
- **Password:** Demo123!

## CI/CD (GitHub Actions)

Four workflows, each with a single purpose. **Never propose adding a fifth that overlaps in scope.**

| Workflow | Trigger | Purpose |
|---|---|---|
| [`ci.yml`](../.github/workflows/ci.yml) | PR opened | Lint + lockfile sync check + unit tests (non-blocking) + per-PR Neon migration dry-run (only when `schema.prisma` or `migrations/**` changes) |
| [`deploy-staging.yml`](../.github/workflows/deploy-staging.yml) | Push to `main` | Auto-deploy to `smart-apply-api-staging` (Fly, `fly.staging.toml`) + `smart-apply-web-staging` (Worker, `env.staging` block). No approval. Reads from `staging` GitHub Environment. |
| [`release-please.yml`](../.github/workflows/release-please.yml) | Push to `main` | Maintains a Release PR + creates `v*.*.*` tags from Conventional Commits. Uses a PAT (`RELEASE_PLEASE_TOKEN`) so tag pushes trigger downstream workflows (default `GITHUB_TOKEN` doesn't). |
| [`deploy-prod.yml`](../.github/workflows/deploy-prod.yml) | Tag `v*.*.*` push | Deploys to `smart-apply-api` (Fly, `fly.prod.toml`) + `smart-apply-web` (Worker, default env). Gated by `production` GitHub Environment (manual approval). |

**Migrations** run as a Fly **release command** (`prisma migrate deploy`) before machines start serving traffic — same command on staging and prod, against each env's `DIRECT_URL` secret.

⚠️ **`PUBLIC_API_URL` trap**: leave the GitHub repo Variable **unset** in prod so the workflow default (`https://api.smart-apply.io/api/v1`) wins. Setting it to a `*.fly.dev` URL bakes the wrong origin into the Worker bundle and breaks CORS / cookies.

⚠️ **PAT requirement**: `release-please` needs a fine-grained PAT with `contents:write` + `pull-requests:write` + `workflows:write`, scoped to the Smart-Apply org and the smart-apply repo only. Stored as `RELEASE_PLEASE_TOKEN` repo secret. Without it, tags don't trigger `deploy-prod.yml`.

## Minimal Cloud Resources (production + staging)
- **Fly.io**: two apps in region `fra` —
  - `smart-apply-api` (prod, 2x2GB, `min_machines_running = 2`, Let's Encrypt cert for `api.smart-apply.io` via DNS-01)
  - `smart-apply-api-staging` (staging, 1x1GB, `min_machines_running = 0` — suspend on idle)
- **Cloudflare**: two Workers —
  - `smart-apply-web` (prod, Custom Domains: apex + `www.smart-apply.io`)
  - `smart-apply-web-staging` (staging, `*.workers.dev` URL)
  - Plus DNS zone `smart-apply.io`, two R2 buckets (`smart-apply-prod` + `smart-apply-staging`, both EU jurisdiction), Universal SSL
- **Neon**: one Postgres project (EU/Frankfurt) with two branches — `main` (prod) + `staging` (cow off `main`). Each branch has its own pooled (`DATABASE_URL`) + direct (`DIRECT_URL`) URLs.
- **Upstash**: QStash (queue, shared between envs — staging gets its own webhook URL) + Redis (prod throttler only; staging uses `THROTTLER_STORAGE=memory` since it runs single-instance)
- **Azure**: OpenAI resource with three deployments — `gpt-4.1` (prod, 200K TPM), `gpt-4.1-staging` (staging), `gpt-4.1-local` (your laptop)
- **Third-party**: Resend (email), Sentry (monitoring)

## Tests
**Backend (apps/api)**
- E2E: Auth (register, login, me), Profile CRUD, Application pipeline (mock LLM + in-memory providers)
- Run: `cd apps/api && pnpm test:e2e`

**Frontend (apps/web)**
- ESLint validation (TypeScript strict mode, no `any` types)
- Production build test (validates all pages compile)
- Run: `cd apps/web && pnpm lint && pnpm build`