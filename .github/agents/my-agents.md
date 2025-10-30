---
name: Smart Apply Backend Agent
description: AI-powered job application assistant API - NestJS backend with Azure integration for generating tailored cover letters and resumes
---

# Smart Apply Backend Agent

This agent assists in building and maintaining the Smart Apply MVP backend - a production-grade NestJS REST API that manages candidate profiles, parses job postings, and generates tailored cover letters and resumes using Azure OpenAI. The application follows Azure-first architecture patterns with multi-provider abstractions for storage, LLM, and queue services.

## Tech Stack

- **Framework:** NestJS v10 (TypeScript)
- **Database:** PostgreSQL (Prisma ORM)
- **Authentication:** JWT + argon2
- **Cloud:** Azure (Container Apps, PostgreSQL Flexible Server, Blob Storage, Service Bus, OpenAI)
- **PDF Generation:** Puppeteer/Chromium
- **Testing:** Jest + supertest (E2E)
- **Documentation:** Swagger/OpenAPI

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
├── apps/api/
│   ├── src/
│   │   ├── main.ts                  # Entry point (Port 3000, Swagger /docs)
│   │   ├── app.module.ts            # Root module
│   │   │
│   │   ├── config/                  # ✅ Global config (Zod)
│   │   ├── common/                  # ✅ Guards, Decorators, Filters
│   │   ├── prisma/                  # ✅ DB service (Global)
│   │   │
│   │   ├── auth/                    # ✅ JWT auth (Register, Login, /me)
│   │   ├── profile/                 # ✅ User profile CRUD
│   │   ├── storage/                 # ✅ Storage abstraction
│   │   ├── llm/                     # ✅ LLM abstraction
│   │   │
│   │   ├── uploads/                 # ⏳ File upload (PDF/DOCX)
│   │   ├── job-postings/            # ⏳ Job posting parser
│   │   ├── pdf/                     # ⏳ Puppeteer PDF service
│   │   ├── jobs/                    # ⏳ Queue abstraction (Service Bus)
│   │   ├── applications/            # ⏳ Main pipeline
│   │   └── health/                  # ⏳ Health checks (Terminus)
│   │
│   ├── prisma/
│   │   ├── schema.prisma            # Database schema
│   │   ├── migrations/              # Prisma migrations
│   │   └── seed.ts                  # Demo data (demo@smartapply.com)
│   │
│   └── test/
│       ├── profile.e2e-spec.ts      # ✅ Profile E2E (has Guard issues)
│       └── ...                      # ⏳ Additional E2E tests
│
├── prompts/                         # ⏳ LLM template files
│   ├── cover-letter.md              # Cover letter prompt
│   └── resume.md                    # Resume prompt
│
├── .github/
│   └── copilot-instructions.md      # General Copilot instructions
│
├── ARCHITECTURE.md                  # Complete architecture docs
├── my-agents.md                     # ← This file
├── docker-compose.yml               # Local PostgreSQL setup
├── .env                             # Environment variables (not in Git!)
└── package.json                     # Dependencies + scripts
```

## Current TODOs (Priority Order)

### 1. ⏳ UploadsModule (GitHub Issue #2)

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

### When Generating Code

1. **Always** create DTOs with validation decorators
2. **Always** use Swagger decorators (`@ApiTags`, `@ApiBearerAuth`)
3. **Always** implement error handling (try/catch + meaningful exceptions)
4. **Always** respect TypeScript strict mode (no `any` without reason)
5. **Follow provider pattern** (see Storage/LLM as reference)

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

## Important Commands

```bash
# Development
npm run start:dev              # Dev server with watch mode
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

## Reference Files

When unsure, check these files:

- **Architecture:** `ARCHITECTURE.md`
- **Copilot Instructions:** `.github/copilot-instructions.md`
- **Prisma Schema:** `apps/api/prisma/schema.prisma`
- **Environment Schema:** `apps/api/src/config/env.schema.ts`
- **Auth Example:** `apps/api/src/auth/` (fully implemented)
- **Profile Example:** `apps/api/src/profile/` (fully implemented)
- **Storage Example:** `apps/api/src/storage/` (provider pattern reference)
- **LLM Example:** `apps/api/src/llm/` (provider pattern reference)

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
