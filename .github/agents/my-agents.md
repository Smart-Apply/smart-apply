---
name: Smart-Apply-Full-Stack-Agent
description: AI-powered job application assistant - NestJS backend + Next.js 14 frontend with Azure integration for generating tailored cover letters and resumes
---

# Smart Apply Full-Stack Agent

This agent assists in building and maintaining the Smart Apply MVP - a full-stack application consisting of:
- **Backend:** Production-grade NestJS REST API with Azure OpenAI, Blob Storage, and Service Bus
- **Frontend:** Next.js 14 with TypeScript, Tailwind CSS, shadcn/ui for user-facing features

The application follows Azure-first architecture patterns with multi-provider abstractions for storage, LLM, and queue services.

## Tech Stack

### Backend (apps/api)
- **Framework:** NestJS v10 (TypeScript)
- **Database:** PostgreSQL (Prisma ORM)
- **Authentication:** JWT + argon2
- **Cloud:** Azure (Container Apps, PostgreSQL Flexible Server, Blob Storage, Service Bus, OpenAI)
- **PDF Generation:** Puppeteer/Chromium
- **Testing:** Jest + supertest (E2E)
- **Documentation:** Swagger/OpenAPI (Port 3000)

### Frontend (apps/web)
- **Framework:** Next.js 14 with App Router
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4
- **UI Library:** shadcn/ui (Radix UI)
- **State Management:** Zustand + React Query
- **Forms:** React Hook Form + Zod
- **PDF Handling:** react-pdf + pdfjs-dist
- **Rich Text:** Tiptap
- **Icons:** Lucide React
- **Notifications:** Sonner (Port 3001)

## Architecture Principles

### Module-First Design

Every feature is a self-contained NestJS module with:

- **Controller** → REST endpoints (JWT-protected, except `/auth` with `@Public()`)
- **Service** → Business logic
- **DTOs** → Validation (class-validator)
- **Module** → Dependency injection setup

### Provider Abstraction

Multi-provider architecture for different environments:

1. **StorageService** (`src/storage/`)
   - `DiskStorageProvider` (dev/local)
   - `AzureBlobStorageProvider` (prod)
   - Configuration via `STORAGE_DRIVER` env var

2. **LLMService** (`src/llm/`)
   - `MockLLMProvider` (dev/testing)
   - `AzureOpenAIProvider` (prod)
   - Configuration via `LLM_PROVIDER` env var

3. **JobsService** (TODO: `src/jobs/`)
   - `InMemoryQueueProvider` (dev)
   - `AzureServiceBusProvider` (prod)
   - Configuration via `JOBS_DRIVER` env var

**Important:** All providers implement a common interface. New providers should follow the same pattern.

### Database-First Workflow

```bash
# Modify schema
vi apps/api/prisma/schema.prisma

# Create and apply migration
npm run prisma:migrate

# Generate Prisma Client
npm run prisma:generate

# Optional: Seed data
npm run prisma:seed
```

### Environment Configuration

- **Local Dev:** `.env` file (dotenv preloaded via `node -r dotenv/config`)
- **Production:** Azure Key Vault + Container Apps Secrets
- **Validation:** Zod schema in `src/config/env.schema.ts`

## Project Structure

```
smart-apply/
├── apps/
│   ├── api/                         # Backend (Port 3000)
│   │   ├── src/
│   │   │   ├── main.ts              # Entry point (Swagger /docs)
│   │   │   ├── app.module.ts        # Root module
│   │   │   │
│   │   │   ├── config/              # ✅ Global config (Zod)
│   │   │   ├── common/              # ✅ Guards, Decorators, Filters
│   │   │   ├── prisma/              # ✅ DB service (Global)
│   │   │   │
│   │   │   ├── auth/                # ✅ JWT auth (Register, Login, /me)
│   │   │   ├── profile/             # ✅ User profile CRUD with Education
│   │   │   ├── storage/             # ✅ Storage abstraction
│   │   │   ├── llm/                 # ✅ LLM abstraction
│   │   │   │
│   │   │   ├── uploads/             # ⏳ File upload (PDF/DOCX)
│   │   │   ├── job-postings/        # ⏳ Job posting parser
│   │   │   ├── pdf/                 # ⏳ Puppeteer PDF service
│   │   │   ├── jobs/                # ⏳ Queue abstraction (Service Bus)
│   │   │   ├── applications/        # ⏳ Main pipeline
│   │   │   └── health/              # ⏳ Health checks (Terminus)
│   │   │
│   │   ├── prisma/
│   │   │   ├── schema.prisma        # Database schema
│   │   │   ├── migrations/          # Prisma migrations
│   │   │   └── seed.ts              # Demo data
│   │   │
│   │   └── test/                    # E2E tests
│   │
│   └── web/                         # Frontend (Port 3001)
│       ├── src/
│       │   ├── app/
│       │   │   ├── (auth)/          # ✅ Login, Register pages
│       │   │   ├── (dashboard)/     # ✅ Dashboard layout + pages
│       │   │   ├── layout.tsx       # ✅ Root layout with Providers
│       │   │   └── page.tsx         # ✅ Landing page
│       │   │
│       │   ├── components/
│       │   │   ├── ui/              # ✅ shadcn/ui (13 components)
│       │   │   ├── forms/           # ⏳ Form components
│       │   │   ├── pdf/             # ⏳ PDF preview/editing
│       │   │   └── shared/          # ⏳ Shared components
│       │   │
│       │   ├── hooks/               # ✅ useProfile, useApplications
│       │   ├── stores/              # ✅ Zustand auth store
│       │   ├── lib/
│       │   │   ├── api-client.ts    # ✅ Typed API client
│       │   │   ├── providers.tsx    # ✅ React Query provider
│       │   │   └── utils.ts         # ✅ Helper functions
│       │   │
│       │   └── types/               # ✅ TypeScript types
│       │
│       ├── .env.local               # ✅ NEXT_PUBLIC_API_URL
│       ├── README.md                # ✅ Frontend docs
│       └── package.json             # ✅ Dependencies (450 pkgs)
│
├── prompts/                         # ⏳ LLM template files
│   ├── cover-letter.md              # Cover letter prompt
│   └── resume.md                    # Resume prompt
│
├── .github/
│   ├── copilot-instructions.md      # General Copilot instructions
│   └── agents/
│       └── my-agents.md             # ← This file
│
├── docker-compose.yml               # Local PostgreSQL setup
└── package.json                     # Root workspace
```

## Frontend-Backend Integration

### Connection Setup

**Backend:** `http://localhost:3000/api/v1`
**Frontend:** `http://localhost:3001`

The frontend connects to the backend via:
- **API Client:** `apps/web/src/lib/api-client.ts` (Typed fetch wrapper)
- **Auth Store:** `apps/web/src/stores/auth-store.ts` (Zustand with persistence)
- **React Query:** Server state management with caching
- **Environment:** `NEXT_PUBLIC_API_URL` in `.env.local`

### Starting Both Apps

**Terminal 1 - Backend:**
```bash
cd apps/api
npm run start:dev
```

**Terminal 2 - Frontend:**
```bash
cd apps/web
npm run dev
```

### API Endpoints (Backend)

All endpoints return JSON and require JWT Bearer token (except `/auth/*`):

```
POST   /api/v1/auth/register      # Create account
POST   /api/v1/auth/login         # Get JWT token
GET    /api/v1/auth/me            # Current user

GET    /api/v1/profile            # Get profile
PUT    /api/v1/profile            # Update profile (Skills, Experience, Education, etc.)

POST   /api/v1/job-postings:parse # Parse job posting
GET    /api/v1/job-postings       # List job postings
GET    /api/v1/job-postings/:id   # Get job posting
DELETE /api/v1/job-postings/:id   # Delete job posting

POST   /api/v1/applications       # Create application
GET    /api/v1/applications       # List applications
GET    /api/v1/applications/:id   # Get application
GET    /api/v1/applications/:id/files  # Get PDF URLs (SAS)
```

### Frontend Pages (Implemented)

```
/                    # Landing page (Hero + Features)
/login               # Login form
/register            # Registration form
/dashboard           # Dashboard with stats
/profile             # Profile view (⏳ Edit forms pending)
/applications        # Applications list (⏳ Pending)
/applications/new    # Create application (⏳ Pending)
/applications/:id    # Application detail (⏳ Pending)
/jobs                # Job postings (⏳ Pending)
```

## Current TODOs (Priority Order)

### Backend TODOs

#### 1. ⏳ UploadsModule (GitHub Issue #2)

**Goal:** File upload for resumes/certificates with validation.

**Requirements:**

- `POST /api/v1/uploads` (JWT-protected)
- Multipart/Form-Data (PDF/DOCX, max 5 MB)
- Storage via `StorageService` (works with both providers)
- Response: Upload metadata with storage key

**Dependencies:**

- `StorageModule` (✅ already implemented)
- `@nestjs/platform-express` + `multer` (✅ already installed)

**Deliverables:**

- `uploads.controller.ts`, `uploads.service.ts`, `uploads.module.ts`
- DTOs: `UploadResponseDto`
- E2E test: `test/uploads.e2e-spec.ts`

### 2. ⏳ JobPostingsModule

**Goal:** Parse job postings from text/URL/file → normalized in DB.

**Requirements:**

- `POST /api/v1/job-postings:parse` (JWT-protected)
- Input: `{ text?, url?, fileId? }`
- Parsers for:
  - Plain text (direct)
  - URL (HTML via `cheerio`)
  - PDF (via `pdf-parse`)
  - DOCX (via `mammoth`)
- Creates `JobPosting` entity with:
  - `title`, `company`, `location`, `description`
  - Arrays: `requirements[]`, `responsibilities[]`, `niceToHave[]`

**Dependencies (install):**

```bash
npm install cheerio pdf-parse mammoth
npm install -D @types/pdf-parse
```

**Deliverables:**

- `job-postings.controller.ts`, `job-postings.service.ts`, `job-postings.module.ts`
- DTOs: `ParseJobPostingDto`, `JobPostingResponseDto`
- Parsers: `src/job-postings/parsers/` (text, url, pdf, docx)
- E2E test: `test/job-postings.e2e-spec.ts`

### 3. ⏳ PDFModule

**Goal:** HTML → PDF rendering with Puppeteer.

**Requirements:**

- `PDFService.generatePDF(html: string): Promise<Buffer>`
- Puppeteer with Chromium (headless)
- CSS styling for professional PDFs
- Template support (Cover letter + Resume have different layouts)

**Dependencies (install):**

```bash
npm install puppeteer
```

**Docker:** Chromium in container image (`Dockerfile` adjustment):

```dockerfile
RUN apt-get update && apt-get install -y chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
```

**Deliverables:**

- `pdf.service.ts`, `pdf.module.ts`
- Unit tests: Mock HTML → Buffer
- Integration test: Generate real PDF + validate

### 4. ⏳ JobsModule

**Goal:** Queue abstraction for background jobs (Application pipeline).

**Requirements:**

- `JobsService` with producer/consumer pattern
- `InMemoryQueueProvider` (dev) → Array-based, setTimeout
- `AzureServiceBusProvider` (prod) → `@azure/service-bus`
- Job types: `APPLICATION_GENERATE` (extensible for future jobs)

**Deliverables:**

- `jobs.service.ts`, `jobs.module.ts`
- `providers/in-memory-queue.provider.ts`, `providers/azure-service-bus.provider.ts`
- `processors/application.processor.ts` (contains pipeline logic)
- Unit tests: Mock queue operations

### 5. ⏳ ApplicationsModule (Main Pipeline)

**Goal:** Orchestrates entire generation workflow.

**Requirements:**

- `POST /api/v1/applications` → Creates application (status: PENDING), publishes job
- `GET /api/v1/applications/:id` → Current status + metadata
- `GET /api/v1/applications/:id/files` → SAS URLs for PDFs

**Pipeline (in job processor):**

1. Load Profile + JobPosting (Prisma)
2. Render prompts (`prompts/cover-letter.md`, `prompts/resume.md`) with context
3. Call `LLMService.generate()` → Markdown/HTML
4. Call `PDFService.generatePDF()` → Buffer
5. Upload PDFs via `StorageService` → Storage keys
6. Update Application: `status = READY`, `coverLetterFileKey`, `resumeFileKey`
7. On error: `status = FAILED`, `errorMessage`

**Deliverables:**

- `applications.controller.ts`, `applications.service.ts`, `applications.module.ts`
- DTOs: `CreateApplicationDto`, `ApplicationResponseDto`, `ApplicationFilesDto`
- Processor: `src/jobs/processors/application.processor.ts` (pipeline logic)
- E2E test: `test/applications.e2e-spec.ts` (with Mock LLM + In-Memory Queue)

### 6. ⏳ HealthModule

**Goal:** Health checks for Container Apps probes.

**Requirements:**

- `GET /api/v1/health` (Public, no JWT)
- Checks:
  - Database (Prisma ping)
  - Storage (Provider `healthCheck()`)
  - LLM (Provider `healthCheck()`)
- Response: `{ status: "ok" | "error", info: {...} }`

**Dependencies:**

```bash
npm install @nestjs/terminus
```

**Deliverables:**

- `health.controller.ts`, `health.module.ts`
- Custom health indicators: `StorageHealthIndicator`, `LLMHealthIndicator`
- E2E test: Verify health endpoint

### 7. ⏳ Complete E2E Tests

**Goal:** Complete test suite for all modules.

**Requirements:**

- Profile CRUD (✅ exists, but fix Guard issues)
- Upload flow (Upload file → validate metadata)
- JobPosting parsing (Text/URL/File → validate extraction)
- Application pipeline end-to-end:
  - Mock LLM provider
  - In-memory queue
  - Validate PDFs are created + stored
  - Validate status transitions (PENDING → GENERATING → READY)

**Deliverables:**

- `test/uploads.e2e-spec.ts`
- `test/job-postings.e2e-spec.ts`
- `test/applications.e2e-spec.ts`
- Fixtures: `test/fixtures/` (Sample PDFs, DOCX, HTML)

## Security Best Practices

### Authentication & Authorization

- **All endpoints** are JWT-protected (except `/auth/*` and `/health`)
- Set `@Public()` decorator explicitly for open endpoints
- Use `@CurrentUser()` decorator for user context in controllers

### Input Validation

- **Always** use DTOs with class-validator
- File uploads: Validate MIME-type + extension + size
- SQL injection: Prisma protects automatically (prepared statements)

### Secrets Management

- **Never** commit secrets in code
- Local: `.env` (in `.gitignore`)
- Prod: Azure Key Vault (via `DefaultAzureCredential`)

### Rate Limiting

- `@nestjs/throttler` already configured (global)
- Critical endpoints: Custom throttler guards

## Testing Guidelines

### Unit Tests

```bash
npm test -- profile.service.spec.ts
```

- Mock external dependencies (Prisma, Storage, LLM)
- Test business logic in isolation

### E2E Tests

```bash
npm run test:e2e
```

- Use in-memory providers (Mock LLM, Disk Storage, In-Memory Queue)
- Create test DB (separate DATABASE_URL in `.env.test`)
- After each test: Cleanup (Prisma `deleteMany`)

### Local Test Workflow

```bash
# 1. Start DB
docker compose up -d

# 2. Run migrations
npm run prisma:migrate

# 3. Seed data
npm run prisma:seed

# 4. Start dev server
npm run start:dev

# 5. Open Swagger
open http://localhost:3000/docs

# 6. Test login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@smartapply.com","password":"Demo123!"}'
```

## Code Style & Conventions

### Naming Conventions

- **Files:** `kebab-case` (e.g., `profile.service.ts`)
- **Classes:** `PascalCase` (e.g., `ProfileService`)
- **Interfaces:** `PascalCase` with optional `I` prefix (e.g., `IStorageProvider`)
- **DTOs:** `PascalCase` with suffix (e.g., `UpdateProfileDto`)
- **Endpoints:** `kebab-case` (e.g., `/job-postings:parse`)

### Module Structure Template

```typescript
// my-feature.module.ts
import { Module } from '@nestjs/common';
import { MyFeatureController } from './my-feature.controller';
import { MyFeatureService } from './my-feature.service';

@Module({
  controllers: [MyFeatureController],
  providers: [MyFeatureService],
  exports: [MyFeatureService], // If other modules use it
})
export class MyFeatureModule {}
```

### Controller Template

```typescript
import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('my-feature')
@Controller('my-feature')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MyFeatureController {
  constructor(private readonly myFeatureService: MyFeatureService) {}

  @Get()
  async getAll(@Request() req) {
    return this.myFeatureService.findAll(req.user.userId);
  }
}
```

### Service Template

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MyFeatureService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string) {
    return this.prisma.myModel.findMany({ where: { userId } });
  }
}
```

## Agent Behavior: Important Rules

### When Generating Backend Code

1. **Always** create DTOs with validation decorators
2. **Always** use Swagger decorators (`@ApiTags`, `@ApiBearerAuth`)
3. **Always** implement error handling (try/catch + meaningful exceptions)
4. **Always** respect TypeScript strict mode (no `any` without reason)
5. **Follow provider pattern** (see Storage/LLM as reference)

### When Generating Frontend Code

1. **Always** use TypeScript (no `any` types without reason)
2. **Always** create proper types in `src/types/index.ts`
3. **Always** use shadcn/ui components (not custom unstyled components)
4. **Always** use React Hook Form + Zod for forms
5. **Always** use React Query for data fetching
6. **Always** protect routes (check auth in layout or middleware)
7. **Always** handle loading/error states
8. **Always** use toast notifications (sonner) for user feedback
9. **Server Components:** Use by default (no 'use client' unless needed)
10. **Client Components:** Only when using hooks, events, or browser APIs

### When Writing Tests

1. **Unit tests:** Mock all dependencies (Prisma, external services)
2. **E2E tests:** Use in-memory providers (no real Azure)
3. **Fixtures:** Create sample data in `test/fixtures/`
4. **Cleanup:** Clear DB after each E2E test

### When Creating Migrations

1. **Always** run `npm run prisma:migrate`
2. **Always** update seed.ts if schema changes
3. **Never** manual SQL edits (only via Prisma schema)

### When Adding Modules

1. **Always** import in `app.module.ts`
2. **Always** declare dependencies (imports in module)
3. **Always** create E2E test
4. **Always** generate Swagger docs

### When Working with Azure

1. **Always** implement local fallback provider (dev)
2. **Never** hardcode Azure credentials
3. **Always** use environment variables (`STORAGE_DRIVER`, `LLM_PROVIDER`)

## Frontend TODOs (GitHub Issues #39-#55)

### Implemented (✅)
- **#39:** Authentication (Login, Register, Protected Routes)
- **#40:** Layout (App Shell, Sidebar Navigation, Mobile Menu)
- **#41:** Dashboard (Stats, Recent Applications - partial)

### Pending (⏳)
- **#42:** Profile Edit - Basic Info Form
- **#43:** Profile - Skills Management (chips, add/remove)
- **#44:** Profile - Experience Management (CRUD)
- **#45:** Profile - Education Management (CRUD)
- **#46:** Profile - Certificates Management (CRUD)
- **#47:** Profile - Projects Management (CRUD)
- **#48:** Job Postings - Input & Parser (Text/URL/File)
- **#49:** Job Postings - List View
- **#50:** Applications - Creation Wizard (3 steps)
- **#51:** Applications - Dashboard & List
- **#52:** Applications - Detail View
- **#53:** Applications - PDF Download & Preview (react-pdf)
- **#54:** Shared - Loading States & Skeletons
- **#55:** Shared - Error Handling & Toasts

**Estimated:** 50-65 hours total

## Important Commands

### Backend (apps/api)
```bash
# Development
npm run start:dev              # Dev server with watch mode (Port 3000)
npm run prisma:studio          # Prisma DB UI

# Database
npm run prisma:migrate         # Create + apply migration
npm run prisma:generate        # Generate Prisma Client
npm run prisma:seed            # Seed demo data

# Testing
npm test                       # Unit tests
npm run test:e2e               # E2E tests
npm run test:cov               # Coverage report

# Linting & Formatting
npm run lint                   # ESLint
npm run format                 # Prettier

# Production
npm run build                  # Build for prod
npm run start:prod             # Start production server
```

### Frontend (apps/web)
```bash
# Development
npm run dev                    # Dev server with Turbopack (Port 3001)

# Testing
npm run lint                   # ESLint check
npm run build                  # Production build (validates types)

# UI Components
npx shadcn@latest add [name]   # Add new shadcn/ui component
```

### Both Apps
```bash
# Start Backend
cd apps/api && npm run start:dev

# Start Frontend (new terminal)
cd apps/web && npm run dev

# Visit:
# - Frontend: http://localhost:3001
# - Backend API: http://localhost:3000/api/v1
# - Swagger Docs: http://localhost:3000/docs
```

## Reference Files

### Backend
- **Architecture:** `ARCHITECTURE.md`
- **Copilot Instructions:** `.github/copilot-instructions.md`
- **Prisma Schema:** `apps/api/prisma/schema.prisma`
- **Environment Schema:** `apps/api/src/config/env.schema.ts`
- **Auth Example:** `apps/api/src/auth/` (fully implemented)
- **Profile Example:** `apps/api/src/profile/` (fully implemented)
- **Storage Example:** `apps/api/src/storage/` (provider pattern reference)
- **LLM Example:** `apps/api/src/llm/` (provider pattern reference)

### Frontend
- **README:** `apps/web/README.md` (setup & features)
- **API Client:** `apps/web/src/lib/api-client.ts` (typed endpoints)
- **Types:** `apps/web/src/types/index.ts` (shared types)
- **Auth Store:** `apps/web/src/stores/auth-store.ts` (Zustand)
- **Providers:** `apps/web/src/lib/providers.tsx` (React Query)
- **Hooks:** `apps/web/src/hooks/` (useProfile, useApplications)
- **UI Components:** `apps/web/src/components/ui/` (shadcn/ui)
- **Auth Pages:** `apps/web/src/app/(auth)/` (login, register)
- **Dashboard:** `apps/web/src/app/(dashboard)/` (layout, pages)

## Known Issues

### Profile E2E Tests - Guard Issues

**Problem:** Tests return `403 Forbidden` instead of `200 OK` or `401 Unauthorized`.

**Cause:** Test setup has ThrottlerGuard or JWT configuration problem.

**Workaround:** Business logic is correct (manually tested via Swagger). Test environment needs different guard configuration.

**TODO:** Fix E2E test setup (separate app instance with `overrideGuard`).

## Success Criteria for TODOs

A TODO is considered **complete** when:

- [ ] Controller, Service, Module implemented
- [ ] DTOs with validation created
- [ ] Swagger documentation generated
- [ ] Unit tests present (min 80% coverage)
- [ ] E2E test present (happy path + error cases)
- [ ] Dev server starts without errors (`npm run start:dev`)
- [ ] Swagger UI shows new endpoints (`http://localhost:3000/docs`)
- [ ] Manual test via Swagger successful

## Next Steps (Post-MVP)

1. **SSE/Webhooks** for application status updates
2. **Multi-tenant** support (organizations/workspaces)
3. **Version history** for applications (edit flow)
4. **Managed Identity** instead of connection strings
5. **Prometheus/Grafana** monitoring
6. **ATS export** (JSON format for applicant tracking systems)
