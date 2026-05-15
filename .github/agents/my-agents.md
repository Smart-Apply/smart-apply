---
name: Smart-Apply-Full-Stack-Agent
description: AI-powered job application assistant - NestJS backend + Next.js 16 frontend with Azure integration for generating tailored cover letters and resumes
---

# Smart Apply Full-Stack Agent

This agent assists in building and maintaining the Smart Apply MVP - a full-stack application consisting of:
- **Backend:** Production-grade NestJS REST API with Azure OpenAI, Blob Storage, and Service Bus
- **Frontend:** Next.js 16 with React 19, TypeScript, Tailwind CSS, shadcn/ui for user-facing features

The application follows Azure-first architecture patterns with multi-provider abstractions for storage, LLM, and queue services.

## Tech Stack

### Backend (apps/api)
- **Framework:** NestJS v10 (TypeScript)
- **Database:** PostgreSQL (Prisma ORM)
- **Authentication:** JWT + argon2 + OAuth 2.0 (Google, Microsoft)
- **OAuth:** passport-google-oauth20, passport-microsoft
- **Cloud:** Azure (Container Apps, PostgreSQL Flexible Server, Blob Storage, Service Bus, OpenAI)
- **PDF Generation:** Puppeteer/Chromium
- **Testing:** Vitest 2.1 + supertest (E2E)
- **Documentation:** Swagger/OpenAPI (Port 3000)

### Frontend (apps/web)
- **Framework:** Next.js 16.0.1 with App Router
- **React:** 19.2.0
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS v4
- **UI Library:** shadcn/ui (Radix UI)
- **State Management:** Zustand 5 + React Query 5
- **Forms:** React Hook Form 7 + Zod 4
- **PDF Handling:** react-pdf 10 + pdfjs-dist
- **Rich Text:** Tiptap 3
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

3. **AgentsModule** (`src/agents/`)
   - `ATSKeywordAgent` - Extracts keywords from job postings using Azure AI Foundry
   - `CVWriterAgent` - Generates tailored resumes based on keywords + profile
   - `CLWriterAgent` - Generates cover letters based on keywords + profile
   - `ApplicationPipelineService` - Orchestrates all agents with EventEmitter progress updates
   - Configuration via `ATS_AGENT_ID`, `CV_WRITER_AGENT_ID`, `CL_WRITER_AGENT_ID` env vars

4. **JobsService** (`src/jobs/`)
   - `InMemoryQueueProvider` (dev)
   - `AzureServiceBusProvider` (prod)
   - Configuration via `JOBS_DRIVER` env var

5. **TemplatesModule** (`src/templates/`)
   - Resume and Cover Letter templates with multilingual support
   - Color variants and base template grouping
   - Preview image generation

6. **UserPreferencesModule** (`src/user-preferences/`)
   - Notification settings, language, theme preferences
   - Privacy and analytics settings

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

## Key Directories

- `apps/api/src/` - Backend modules (auth, profile, applications, templates, user-preferences, etc.)
- `apps/api/src/agents/` - Azure AI Foundry agents (ATS, CV Writer, CL Writer)
- `apps/api/src/keywords/` - Keyword extraction service
- `apps/api/src/templates/` - Resume/Cover Letter template management
- `apps/api/src/user-preferences/` - User settings (notifications, language, theme)
- `apps/api/prisma/` - Schema, migrations, seed
- `apps/web/src/app/` - Next.js pages (auth, dashboard, settings)
- `apps/web/src/components/` - UI components (shadcn/ui)
- `apps/web/src/components/applications/` - ATS analysis & PDF editor components
- `apps/web/src/components/templates/` - Template selection & preview
- `apps/web/src/lib/` - API client, utils, pdf-utils
- `prompts/` - LLM templates (cover-letter.md, resume.md)

## Quick Start

**Backend:** `cd apps/api && npm run start:dev` (Port 3000)
**Frontend:** `cd apps/web && npm run dev` (Port 3001)
**Swagger:** http://localhost:3000/docs

**Connection:** Frontend uses `api-client.ts` with `credentials: 'include'` for HttpOnly cookies

## Backend Status

**All Core Modules Implemented ✅**
- Auth (JWT + argon2, HttpOnly cookies, refresh tokens, **OAuth 2.0: Google + Microsoft**)
- Profile (differential updates for nested collections including Languages)
- Job Postings (parse text/URL/file, Azure AI Agent for URL parsing, soft delete)
- Applications (ATS Agent → CV/CL Writer Agents → PDF → Storage pipeline, soft delete)
- Templates (Resume/Cover Letter templates with multilingual + color variants)
- User Preferences (notifications, language, theme, privacy settings)
- Storage (Disk + Azure Blob providers)
- LLM (Mock + Azure OpenAI providers)
- Jobs (In-Memory + Service Bus providers)
- PDF (Puppeteer with ATS-optimized templates)
- Keywords (ATS keyword extraction and matching)
- Health (Terminus)

**ATS-Optimized PDF Generation ✅**
- Multiple professional templates with color variants
- Multilingual support (DE, EN) with automatic detection
- Simple HTML structure for ATS parsing
- No complex layouts, tables, or columns
- Standard fonts (Arial, system fonts)
- Languages section with proficiency levels
- Templates stored in database (`Template` model with `baseTemplateId` grouping)
- Seeded via `npm run prisma:seed:templates`

**Testing:**
- E2E tests for all modules
- XSS sanitization tests (15 passing)
- Auth tests (register, login, me)

**See GitHub Issues for remaining work (current: #276-#284)**

## ATS Agent Architecture

### Overview

The ATS (Applicant Tracking System) analysis feature uses Azure AI Foundry Agents to extract keywords from job postings and match them against the user's resume. This provides real-time feedback on how well a resume matches a job posting.

### Agent Pipeline

```
Job Posting → [ATS Agent] → Keywords → [Matching] → Score + Analysis
                                            ↑
                                    Resume Text (from application)
```

### Components

**1. ATSKeywordAgent** (`src/agents/ats/ats-keyword.agent.ts`)
- Uses Azure AI Foundry SDK (`@azure/ai-agents`)
- Agent ID: `asst_Jn2tlDlX3ZhzVIQhhw5Qa57W`
- Extracts structured keywords from job postings:
  - Technical skills (programming languages, frameworks)
  - Soft skills (communication, leadership)
  - Tools & technologies (specific software, platforms)
  - Industry keywords (domain-specific terms)
  - Seniority signals (experience levels)
  - Requirement keywords (certifications, education)

**2. KeywordsService** (`src/keywords/keywords.service.ts`)
- Orchestrates keyword extraction via ATS Agent
- Parses agent response into structured format
- Handles fallback to mock data for testing

**3. ApplicationsService** (ATS methods)
- `getKeywordsAnalysis()` - Returns cached analysis or triggers new one
- `analyzeKeywords()` - Fresh extraction and matching
- `extractResumeKeywords()` - Extracts keywords from saved resume JSON
- `extractProfileKeywords()` - Fallback: extracts from user profile
- `matchKeywords()` - Compares job keywords against resume/profile
- `calculateMatchAnalysis()` - Calculates scores and suggestions

### Matching Logic

Keywords are matched against the application's `resumeText` (not the profile), which allows:
- ATS score to reflect edits made in edit mode
- Users to optimize their resume for specific jobs
- Real-time feedback when adding keywords

**Score Calculation (Weighted):**
- Technical skills: 40%
- Experience/seniority: 25%
- Soft skills: 20%
- Industry keywords: 15%

### Frontend Components

**ATSAnalysisPanel** (`components/applications/ats-analysis-panel.tsx`)
- Main panel for application detail page
- Shows match score, keywords, and suggestions
- "Neu analysieren" button for fresh analysis

**ATSScoreSidebar** (`components/applications/ats-score-sidebar.tsx`)
- Compact sidebar for edit mode
- Shows score and missing keywords
- Auto-refreshes after saving resume

**Supporting Components:**
- `MatchScoreCard` - Score visualization with category breakdown
- `KeywordsOverview` - Tabbed view of all/found/missing keywords
- `SuggestionsCard` - Improvement recommendations with profile links
- `HighlightedText` - Keyword highlighting in text

### Environment Variables

```bash
# Azure AI Foundry Agents
AZURE_AI_FOUNDRY_ENDPOINT=https://your-project.api.azureml.ms
ATS_AGENT_ID=asst_Jn2tlDlX3ZhzVIQhhw5Qa57W
CV_WRITER_AGENT_ID=asst_xxxxx  # Optional
CL_WRITER_AGENT_ID=asst_xxxxx  # Optional

# OAuth Providers (all optional - fallback to email/password auth)
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
AZURE_AD_CLIENT_ID=your-azure-ad-client-id
AZURE_AD_CLIENT_SECRET=your-azure-ad-client-secret
AZURE_AD_TENANT_ID=common  # Use 'common' for multi-tenant, or specific tenant ID
```

### Database Fields

**Application model:**
- `title` (String?) - Custom editable title (LLM-generated on creation)
- `targetJobTitle` (String?) - Target job title for CV/CL (defaults to jobPosting.title)
- `applicationStatus` (Enum) - User-facing: CREATED, APPLIED, INTERVIEW, ACCEPTED, REJECTED
- `status` (Enum) - System-facing: PENDING, GENERATING, READY, FAILED
- `keywordsData` (Json?) - Cached keyword analysis results
- `matchScore` (Float?) - Overall match score (0-100)
- `matchDetails` (Json?) - Detailed match breakdown
- `atsKeywords` (Json?) - Focused 20-keyword set from ATS Agent
- `tailoredProfile` (Json?) - Selected profile data for debugging
- `deletedAt` (DateTime?) - Soft delete timestamp

**JobPosting model:**
- `language` (String?) - Detected language (ISO 639-1: "de", "en")
- `fullText` (Text) - Full cleaned job posting for CV/CL agents
- `deletedAt` (DateTime?) - Soft delete timestamp

**Template model:**
- `language` (String) - ISO 639-1 language code
- `baseTemplateId` (String?) - Groups language/color variants
- `accentColor` (String?) - Primary accent color hex
- `colorVariantName` (String?) - Display name for color variant

**OAuthProvider model:**
- `id` (String) - UUID primary key
- `provider` (OAuthProviderType) - Enum: GOOGLE, MICROSOFT, LINKEDIN, APPLE, FACEBOOK
- `providerId` (String) - External OAuth provider user ID
- `email` (String?) - Email from OAuth provider
- `displayName` (String?) - Display name from OAuth provider
- `avatarUrl` (String?) - Profile picture URL from OAuth provider
- `accessToken` (String?) - Encrypted OAuth access token
- `refreshToken` (String?) - Encrypted OAuth refresh token
- `tokenExpiry` (DateTime?) - Token expiration timestamp
- `userId` (String) - Foreign key to User
- `createdAt`, `updatedAt` - Timestamps
- **Constraints:** `@@unique([provider, providerId])`, `@@unique([provider, userId])`

**User model (OAuth additions):**
- `avatarUrl` (String?) - Profile picture from OAuth providers
- `oauthProviders` (OAuthProvider[]) - Linked OAuth accounts

## Security (8.0/10)

**Implemented:**
- JWT in HttpOnly cookies (XSS-protected)
- argon2 password hashing
- Input sanitization (@Sanitize() decorator)
- CSRF protection (optional, ENABLE_CSRF=true)
- Rate limiting: 5/15min (auth), 100/15min (other)
- Strong password validation
- Helmet security headers
- CORS whitelist

**Details:** See `docs/SECURITY.md` and `docs/CORS_SECURITY.md`

## Testing

**Unit:** `npm test` (mock dependencies)
**E2E:** `npm run test:e2e` (in-memory providers, test DB)
**Local:** Docker → migrate → seed → start:dev → Swagger at :3000/docs

## Code Conventions

- **Files:** `kebab-case` (profile.service.ts)
- **Classes:** `PascalCase` (ProfileService)
- **DTOs:** `PascalCase` + suffix (UpdateProfileDto)
- **Endpoints:** `kebab-case` (/job-postings/parse)
- **Reference:** See existing modules (auth, profile) for patterns

## Development Rules

**Backend:**
- Use DTOs with validation + Swagger decorators
- Follow provider pattern (see storage/llm)
- TypeScript strict mode (no `any`)
- JWT-protect endpoints (use `@Public()` for exceptions)

**Frontend:**
- shadcn/ui components only
- React Hook Form + Zod validation
- React Query for data fetching
- Server Components by default
- Handle 429 rate limit errors

**Testing:**
- Unit: Mock dependencies
- E2E: In-memory providers
- Always cleanup after tests

**Azure:**
- Use env vars (STORAGE_DRIVER, LLM_PROVIDER)
- Local fallback providers for dev

## Frontend Status (~80% Complete)

**Done ✅**
- Auth (Login, Register, Logout, **OAuth: Google + Microsoft buttons**)
- OAuth Integration (Social login buttons, provider linking in Settings)
- Layout (Dashboard with responsive navigation)
- Dashboard (Stats, Recent Applications)
- Profile Management (All forms: Skills, Experience, Education, Certificates, Projects, Languages)
- Job Postings (List, Create via text/URL, Delete)
- Applications (List, Detail View, PDF Preview/Download)
- PDF Edit Mode (Cover Letter + Resume editors with live preview)
- ATS Analysis (Score, Keywords, Suggestions, Real-time matching)
- Template Selection (Resume + Cover Letter templates with previews)
- Settings Page (Notifications, Language, Theme, Privacy)

**Pending ⏳**
- Template color variant selection
- Full address fields (Issue #282)
- Intelligent PDF filenames (Issue #284)
- Various UX improvements (Issues #278-281)
- OAuth: LinkedIn, Apple, Facebook (buttons show "coming soon" toast)

**Details:** See GitHub Issues

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

## API Endpoints Reference

All endpoints are prefixed with `/api/v1` and documented at `http://localhost:3000/docs` (Swagger UI).

### Authentication Endpoints (Public)

**POST /api/v1/auth/register**
- **Purpose:** Register new user account
- **Authentication:** None (Public)
- **Rate Limit:** 5 attempts / 15 minutes (strict auth limit)
- **Body:** `{ email, password, firstName, lastName }`
- **Response:** `{ user: { id, email, firstName, lastName, createdAt } }`
- **Cookie Set:** `access_token` (HttpOnly, Secure in prod, SameSite=strict, 7 days)
- **Notes:** Password hashed with argon2, JWT token in HttpOnly cookie (not in response body)

**POST /api/v1/auth/login**
- **Purpose:** Login existing user
- **Authentication:** None (Public)
- **Rate Limit:** 5 attempts / 15 minutes (strict auth limit)
- **Body:** `{ email, password }`
- **Response:** `{ user: { id, email, firstName, lastName } }`
- **Cookie Set:** `access_token` (HttpOnly, Secure in prod, SameSite=strict, 7 days)
- **Notes:** JWT token in HttpOnly cookie (not in response body)

**GET /api/v1/auth/csrf-token**
- **Purpose:** Get CSRF token for state-changing requests
- **Authentication:** None (Public)
- **Rate Limit:** 100 requests / 15 minutes (default limit, NOT strict auth limit)
- **Response:** `{ csrfToken: string, message: string }`
- **Notes:** Only required if `ENABLE_CSRF=true`. Frontend automatically fetches and includes in X-CSRF-Token header

**GET /api/v1/auth/me**
- **Purpose:** Get current authenticated user
- **Authentication:** Required (JWT from HttpOnly cookie)
- **Response:** `{ id, email, firstName, lastName, createdAt }`
- **Notes:** Used to verify authentication status

**GET /api/v1/auth/logout**
- **Purpose:** Logout user (clear auth cookie)
- **Authentication:** Required (JWT from HttpOnly cookie)
- **Response:** `{ message: "Logged out successfully" }`
- **Cookie Cleared:** `access_token`
- **Notes:** Changed from POST to GET to avoid CSRF validation requirement

### OAuth Endpoints (Public - Redirects)

**GET /api/v1/auth/google**
- **Purpose:** Initiate Google OAuth 2.0 flow
- **Authentication:** None (Public)
- **Behavior:** Redirects to Google consent screen
- **Callback:** `/api/v1/auth/google/callback`
- **Notes:** Requires `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` env vars

**GET /api/v1/auth/google/callback**
- **Purpose:** Handle Google OAuth callback after user consent
- **Authentication:** None (Public, OAuth callback)
- **Behavior:** Creates/links user account, sets HttpOnly cookies, redirects to frontend
- **Cookie Set:** `access_token`, `refresh_token` (HttpOnly, Secure in prod)
- **Redirect:** Frontend dashboard on success, login page with error on failure

**GET /api/v1/auth/microsoft**
- **Purpose:** Initiate Microsoft/Azure AD OAuth flow
- **Authentication:** None (Public)
- **Behavior:** Redirects to Microsoft login page
- **Callback:** `/api/v1/auth/microsoft/callback`
- **Notes:** Requires `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`, `AZURE_AD_TENANT_ID` env vars

**GET /api/v1/auth/microsoft/callback**
- **Purpose:** Handle Microsoft OAuth callback
- **Authentication:** None (Public, OAuth callback)
- **Behavior:** Creates/links user account, sets HttpOnly cookies, redirects to frontend
- **Cookie Set:** `access_token`, `refresh_token` (HttpOnly, Secure in prod)
- **Redirect:** Frontend dashboard on success, login page with error on failure

### OAuth Management Endpoints (Protected)

**GET /api/v1/auth/oauth/providers**
- **Purpose:** List OAuth providers linked to current user's account
- **Authentication:** Required (JWT from HttpOnly cookie)
- **Response:**
  ```typescript
  [
    {
      provider: "GOOGLE" | "MICROSOFT" | "LINKEDIN" | "APPLE" | "FACEBOOK",
      email: string,
      displayName: string,
      avatarUrl: string | null,
      linkedAt: Date
    }
  ]
  ```
- **Notes:** Used in Settings page to show linked accounts

**DELETE /api/v1/auth/oauth/providers/:provider**
- **Purpose:** Unlink OAuth provider from user's account
- **Authentication:** Required (JWT from HttpOnly cookie)
- **Path Param:** `provider` - One of: google, microsoft, linkedin, apple, facebook
- **Response:** `{ message: "Provider unlinked successfully" }`
- **Error:** 400 if provider not linked, 400 if it's the only auth method (no password set)
- **Notes:** Cannot unlink if user has no password and this is their only OAuth provider

### Profile Endpoints (Protected)

All profile endpoints require authentication via JWT in HttpOnly cookie (`access_token`).

**GET /api/v1/profile**
- **Purpose:** Get current user's complete profile with all relations
- **Authentication:** Required
- **Response:** Full profile object with nested arrays:
  ```typescript
  {
    id, userId, firstName, lastName, phone, location,
    linkedinUrl, githubUrl, portfolioUrl, summary,
    skills: [{ id, name, category, level }],
    experiences: [{ id, title, company, location, startDate, endDate, description, isCurrent }],
    education: [{ id, degree, institution, fieldOfStudy, startYear, endYear, description }],
    certificates: [{ id, name, issuer, issueDate, credentialUrl }],
    projects: [{ id, name, description, technologies, url, startDate, endDate }]
  }
  ```
- **Notes:** Returns 404 if profile not found (auto-created on user registration)

**PUT /api/v1/profile**
- **Purpose:** Update user profile (differential update for nested collections)
- **Authentication:** Required
- **Body:** Partial update with any combination of:
  ```typescript
  {
    firstName?, lastName?, phone?, location?, summary?,
    linkedinUrl?, githubUrl?, portfolioUrl?,
    skills?: [{ id?, name, level? }],        // Upsert: with id = update, without = create
    experiences?: [{ id?, title, company, location?, startDate, endDate?, description?, current? }],
    education?: [{ id?, degree, institution, fieldOfStudy, startYear, endYear?, description? }],
    certificates?: [{ id?, name, issuer, dateObtained, url? }],
    projects?: [{ id?, name, description?, technologies?, url?, startDate?, endDate? }]
  }
  ```
- **Response:** Complete updated profile (same structure as GET)
- **Notes:** 
  - Differential update for arrays: items with `id` are updated, without `id` are created
  - Items not included in array are deleted (orphan removal)
  - Empty array `[]` deletes all items in that collection
  - All string inputs sanitized with `@Sanitize()` decorator (XSS protection)

### Job Postings Endpoints (Protected)

**POST /api/v1/job-postings/parse**
- **Purpose:** Parse job posting from text, URL, or file and create normalized record
- **Authentication:** Required
- **Body:** `{ text?, url?, fileKey? }` (exactly one required)
- **Response:** 
  ```typescript
  {
    id, userId, source, rawContent,
    title, company, location, type, salaryRange,
    description, requirements, responsibilities,
    createdAt, updatedAt
  }
  ```
- **Notes:** Currently stores as-is, parsing logic TODO

**GET /api/v1/job-postings**
- **Purpose:** List all job postings for current user
- **Authentication:** Required
- **Response:** Array of job posting objects (same structure as POST response)
- **Notes:** Sorted by createdAt descending

**GET /api/v1/job-postings/:id**
- **Purpose:** Get single job posting by ID
- **Authentication:** Required
- **Response:** Single job posting object
- **Notes:** Returns 404 if not found or doesn't belong to user

**DELETE /api/v1/job-postings/:id**
- **Purpose:** Delete job posting
- **Authentication:** Required
- **Response:** 204 No Content
- **Notes:** Cascade deletes related applications

### Applications Endpoints (Protected)

**POST /api/v1/applications**
- **Purpose:** Create application and trigger background processing pipeline
- **Authentication:** Required
- **Body:** `{ jobPostingId, notes? }`
- **Response:** 
  ```typescript
  {
    id, userId, jobPostingId,
    status: "PENDING",  // Initial status
    coverLetterPath: null,
    resumePath: null,
    notes?,
    createdAt, updatedAt
  }
  ```
- **Pipeline:** PENDING → GENERATING → READY (or FAILED)
  1. Load profile + job posting
  2. Render LLM prompts with data
  3. Call Azure OpenAI (or mock provider)
  4. Generate PDFs with Puppeteer
  5. Upload to Azure Blob Storage
  6. Update status to READY
- **Notes:** Background job submitted to queue (in-memory or Azure Service Bus)

**GET /api/v1/applications**
- **Purpose:** List all applications for current user
- **Authentication:** Required
- **Query Params:** `?includeJobPosting=true` (optional, default: false)
- **Response:** Array of application objects (with optional jobPosting relation)
- **Notes:** Sorted by createdAt descending

**GET /api/v1/applications/:id**
- **Purpose:** Get single application details
- **Authentication:** Required
- **Query Params:** `?includeJobPosting=true` (optional, default: false)
- **Response:** Single application object (with optional jobPosting relation)
- **Notes:** Returns 404 if not found or doesn't belong to user

**GET /api/v1/applications/:id/files**
- **Purpose:** Get SAS URLs for downloading cover letter and resume PDFs
- **Authentication:** Required
- **Response:** 
  ```typescript
  {
    coverLetterUrl: string,  // Azure Blob SAS URL (1 hour expiry)
    resumeUrl: string,       // Azure Blob SAS URL (1 hour expiry)
    expiresAt: string        // ISO timestamp
  }
  ```
- **Notes:** Returns 400 if status is not READY

**GET /api/v1/applications/:id/download/cover-letter**
- **Purpose:** Direct download of cover letter PDF
- **Authentication:** Required
- **Response:** PDF file stream
- **Headers:** Content-Type: application/pdf, Content-Disposition: attachment
- **Notes:** Alternative to SAS URLs, streams from storage provider

**GET /api/v1/applications/:id/download/resume**
- **Purpose:** Direct download of resume PDF
- **Authentication:** Required
- **Response:** PDF file stream
- **Headers:** Content-Type: application/pdf, Content-Disposition: attachment
- **Notes:** Alternative to SAS URLs, streams from storage provider

### Rate Limiting

- **Auth Endpoints** (register, login): 5 attempts / 15 minutes (strict)
- **CSRF Token Endpoint**: 100 requests / 15 minutes (default)
- **All Other Endpoints**: 100 requests / 15 minutes (default)

### ATS Analysis Endpoints (Protected)

**GET /api/v1/applications/:id/keywords**
- **Purpose:** Get keyword analysis for application (cached if available)
- **Authentication:** Required
- **Response:**
  ```typescript
  {
    applicationId: string,
    keywords: {
      technicalSkills: string[],
      softSkills: string[],
      toolsAndTechnologies: string[],
      industryKeywords: string[],
      senioritySignals: string[],
      requirementKeywords: string[]
    },
    matchAnalysis: {
      overallScore: number,          // 0-100 percentage
      categoryScores: {
        technical: number,
        soft: number,
        experience: number,
        industry: number
      },
      suggestions: string[],
      strengths: string[],
      weaknesses: string[]
    },
    matchedKeywords: [{ keyword: string, category: string, found: boolean, confidence: number }],
    missingKeywords: [{ keyword: string, category: string, found: boolean, confidence: number }],
    analyzedAt: Date
  }
  ```
- **Notes:** Returns cached analysis if available, otherwise triggers new analysis

**POST /api/v1/applications/:id/analyze-keywords**
- **Purpose:** Trigger fresh ATS keyword extraction and matching
- **Authentication:** Required
- **Response:** Same structure as GET /keywords
- **Pipeline:**
  1. Extract keywords from job posting using ATS Agent (Azure AI Foundry)
  2. Extract keywords from application's saved resume (NOT profile)
  3. Match keywords and calculate scores
  4. Cache results in `keywordsData` field
- **Notes:** 
  - Uses `resumeText` from application for matching (reflects edits made in edit mode)
  - Falls back to profile if no resume exists
  - ATS Agent ID: `asst_Jn2tlDlX3ZhzVIQhhw5Qa57W`

### Error Responses

All endpoints follow consistent error format:
```typescript
{
  statusCode: number,
  message: string | string[],
  error: string,
  code?: string  // e.g., "EBADCSRFTOKEN" for CSRF errors
}
```

Common status codes:
- `400` Bad Request (validation failed)
- `401` Unauthorized (missing or invalid JWT)
- `403` Forbidden (CSRF token invalid, when enabled)
- `404` Not Found
- `429` Too Many Requests (rate limit exceeded)
- `500` Internal Server Error

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
- **API Client:** `apps/web/src/lib/api-client.ts` (typed endpoints, OAuth URLs)
- **Types:** `apps/web/src/types/index.ts` (shared types)
- **Auth Store:** `apps/web/src/stores/auth-store.ts` (Zustand)
- **Providers:** `apps/web/src/lib/providers.tsx` (React Query)
- **Hooks:** `apps/web/src/hooks/` (useProfile, useApplications)
- **UI Components:** `apps/web/src/components/ui/` (shadcn/ui)
- **Auth Pages:** `apps/web/src/app/(auth)/` (login, register, OAuth callbacks)
- **Auth Components:** `apps/web/src/components/auth/auth-container.tsx` (social login buttons)
- **Dashboard:** `apps/web/src/app/(dashboard)/` (layout, pages)

### OAuth Setup
- **Setup Guide:** `docs/OAUTH_SETUP.md` (Google Cloud Console + Azure AD configuration)
- **Google Strategy:** `apps/api/src/auth/strategies/google.strategy.ts`
- **Microsoft Strategy:** `apps/api/src/auth/strategies/microsoft.strategy.ts`
- **OAuth DTOs:** `apps/api/src/auth/dto/oauth.dto.ts`



## Next Steps (Post-MVP)

1. **SSE/Webhooks** for application status updates
2. **Multi-tenant** support (organizations/workspaces)
3. **Version history** for applications (edit flow)
4. **Managed Identity** instead of connection strings
5. **Prometheus/Grafana** monitoring
6. ~~**ATS export** (JSON format for applicant tracking systems)~~ ✅ **Implemented**
7. ~~**CV/CL Writer Agents** - Integrate CVWriterAgent and CLWriterAgent for full pipeline~~ ✅ **Implemented**
8. **ATS Score History** - Track score changes over time
9. **Intelligent PDF Filenames** - Professional naming with edge case handling (Issue #284)
10. **Full Address Fields** - Street, postal code, city, country (Issue #282)
11. ~~**OAuth Integration** - Google + Microsoft login~~ ✅ **Implemented**
12. **OAuth: LinkedIn** - LinkedIn OAuth provider
13. **OAuth: Apple** - Apple Sign-In provider
14. **OAuth: Account Linking** - Link/unlink OAuth from existing accounts in Settings
