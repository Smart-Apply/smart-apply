# Smart Apply — Full-Stack MVP (Azure)

## Goal
Deliver a minimal yet production-grade application with:
1) **Frontend (Next.js 14)**: User authentication, profile management, job posting input, application dashboard with PDF preview/editing
2) **Backend API (NestJS)**: Stores candidate profile (skills, certificates, experiences, projects), ingests job postings (text/URL/file → normalized), generates tailored cover letter + resume via LLM
3) **PDF Generation**: Exports both as PDFs stored in Azure Blob and retrievable via signed URLs (SAS)

## Agent Instructions
For specific tasks, refer to these specialized instruction files:
- **PDF Templates**: See `apps/api/src/pdf/templates/.copilot-instructions.md` for creating/modifying resume and cover letter templates
- **Template Agent**: See `apps/api/src/pdf/templates/AGENT.md` for the template creation agent workflow

## Domain-Agnostic Design Principles
**Smart Apply is designed to work across ALL professions and industries**, not just IT/tech roles. When writing code, documentation, or examples:
- ✅ **Use diverse profession examples**: Healthcare (Nurse, Doctor), Manufacturing (CNC Operator), Marketing (Content Manager), Sales (Account Executive), Education (Teacher), Finance (Financial Analyst)
- ✅ **Generic terminology**: "Skills" (not "Technical Skills"), "Experience" (not "Development Experience"), "Projects" (not "Software Projects")
- ✅ **Domain-neutral placeholders**: "z.B. Projektmanager, Krankenpfleger, Vertriebsleiter" (not "z.B. Senior Software Engineer")
- ✅ **Inclusive skill categories**: "Core Competencies", "Technical Skills", "Methodologies", "Soft Skills" (not just programming languages/frameworks)
- ❌ **Avoid IT-centric bias**: Don't default to React/TypeScript/Cloud examples in user-facing content

## Non-Goals
- Rich document editing (basic Tiptap editor only)
- Multi-tenant complexity (single-tenant users/roles for MVP)
- Mobile app (responsive web only)

## Azure-first Tech Stack

### Backend (Port 3000)
- **NestJS v10 (TypeScript)**, **Prisma v7.3.0 + PostgreSQL**
  - Dev: Docker Postgres
  - Prod: **Azure Database for PostgreSQL – Flexible Server**
  - **Prisma 7 Changes:**
    - Client generated to `apps/api/src/generated/prisma`
    - Requires `prisma.config.ts` for datasource configuration
    - Uses PrismaPg adapter with connection pooling
    - Node.js >= 20.19 required (using 24.13.0 LTS)
- **Containers/Runtime:** Docker; deploy to **Azure Container Apps (ACA)** (alt: App Service Linux)
- **Storage:** **Azure Blob Storage** (SAS for downloads)
- **Queues/Jobs:** **Azure Service Bus** for pipeline orchestration
- **Secrets:** **Azure Key Vault** (dev via `.env`)
- **LLM:** **Azure OpenAI** (pluggable provider + mock)
- **PDF:** Puppeteer/Chromium
- **Observability:** pino logs, `/health` endpoint (Nest Terminus)
- **Security:** argon2, Helmet, CORS whitelist, rate limit, JwtAuthGuard

### Frontend (Port 3001)
- **Next.js 16.0.1** (v14 architecture with App Router, Server Components, React Compiler)
- **React 19.2.0** with TypeScript (strict mode)
- **Tailwind CSS 3.4.0** (v4 with PostCSS)
- **shadcn/ui** (13 components: Button, Input, Card, Form, Label, Textarea, Select, Badge, Separator, Sheet, Dialog, Tabs, Table)
- **State Management:**
  - Zustand 4.5.0 (auth state with localStorage persistence)
  - @tanstack/react-query 5.28.0 (server state, caching, refetching)
- **Forms & Validation:**
  - react-hook-form 7.51.0 (performant uncontrolled forms)
  - zod 3.23.0 (runtime validation schemas)
- **PDF Handling:**
  - react-pdf 7.7.0 (PDF rendering)
  - pdfjs-dist 5.4.394 (Mozilla PDF.js)
  - @tiptap/react 2.2.0 (rich text editor for cover letter/resume editing)
- **UI/UX:**
  - lucide-react (1000+ icons)
  - sonner 1.4.0 (toast notifications)
  - 450 total packages, 0 vulnerabilities

## Backend Modules
- `auth` (JWT authentication with argon2 password hashing)
- `profile` (CRUD with Skills, Experiences, Education, Certificates, Projects, Languages)
- `uploads` (file → Blob in prod)
- `job-postings` (parse text/URL/file → normalized JobPosting, Azure AI Agent for URL parsing)
- `applications` (pipeline orchestration: profile + job → LLM → PDF → Blob)
- `llm` (Azure OpenAI + Hugging Face + mock providers, **automatic language detection**)
- `pdf` (Puppeteer + Handlebars templates, ATS-optimized PDFs with selectable templates)
- `storage` (disk | azure-blob providers)
- `jobs` (in-memory | service-bus providers)
- `config` (Zod env schema), `common` (filters/guards/decorators)
- `keywords` (ATS keyword extraction and matching with language detection)

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

## Data Model
Use the previously defined Prisma models: **User**, **Profile**, **JobPosting**, **Application**.

## API Endpoints (v1)

All endpoints are prefixed with `/api/v1` and documented at `http://localhost:3000/docs` (Swagger UI).

### Authentication Endpoints (Public)

**POST /api/v1/auth/register**
- Register new user with email/password (argon2 hashed)
- Rate limit: 5 attempts / 15 minutes (strict)
- Sets HttpOnly cookie: `access_token` (Secure in prod, SameSite=strict, 7 days)
- Returns: `{ user: { id, email, firstName, lastName } }` (token in cookie only)

**POST /api/v1/auth/login**
- Login with email/password credentials
- Rate limit: 5 attempts / 15 minutes (strict)
- Sets HttpOnly cookie: `access_token` (Secure in prod, SameSite=strict, 7 days)
- Returns: `{ user: { id, email, firstName, lastName } }` (token in cookie only)

**GET /api/v1/auth/csrf-token**
- Get CSRF token for state-changing requests (optional, only if `ENABLE_CSRF=true`)
- Rate limit: 100 requests / 15 minutes (default, NOT strict auth limit)
- Returns: `{ csrfToken: string, message: string }`
- Frontend auto-fetches and includes in X-CSRF-Token header

**GET /api/v1/auth/me**
- Get current authenticated user details
- Protected: Requires JWT in HttpOnly cookie
- Returns: `{ id, email, firstName, lastName, createdAt }`

**GET /api/v1/auth/logout**
- Logout user (clear auth cookie)
- Protected: Requires JWT in HttpOnly cookie
- Clears: `access_token` cookie
- Returns: `{ message: "Logged out successfully" }`
- Note: Changed from POST to GET to avoid CSRF validation

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
  4. Generate PDFs with Puppeteer
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
1. Load Profile + JobPosting  
2. Render prompt templates (`prompts/cover-letter.md`, `prompts/resume.md`)  
3. Call **Azure OpenAI** (provider interface) → Markdown/HTML  
4. HTML → PDF (Puppeteer)  
5. Store PDFs in **Blob**; persist keys in `Application`  
6. Status: `PENDING → GENERATING → READY | FAILED`  
7. Background work via **Service Bus** (submit → worker)

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

**Future Enhancements 🟢 (Post-MVP)**
- Two-factor authentication (2FA) - TOTP-based
- **Key Vault** for secrets in prod - Azure Key Vault integration
- Short-TTL **SAS** for file downloads - 15-minute expiry
- GDPR-friendly deletion - Data export and deletion workflows
- Enhanced audit logging - Real-time alerts, SIEM integration

**Security Roadmap**
See `MVP_FEATURES.md` for detailed security tasks with priorities and estimates.

## Environment Variables

### Backend (apps/api/.env)
```bash
DATABASE_URL=postgresql://postgres:postgres@db:5432/smartapply

# Security - JWT (CRITICAL: Generate with: openssl rand -base64 64)
JWT_SECRET=REPLACE_WITH_SECURE_RANDOM_SECRET_MINIMUM_64_CHARACTERS

# Security - CORS (Production: Set to your frontend domain)
CORS_ORIGINS=http://localhost:3000,http://localhost:3001

# Security - Rate Limiting
RATE_LIMIT_TTL=900           # 15 minutes in seconds
RATE_LIMIT_MAX=1000          # Standard endpoints: 1000 requests per 15 min (dev: 1000, prod: 300-500)
RATE_LIMIT_AUTH_TTL=900      # Auth endpoints: 15 minutes
RATE_LIMIT_AUTH_MAX=5        # Auth endpoints: 5 attempts per 15 min (STRICT)

# Security - CSRF Protection (Optional)
ENABLE_CSRF=false            # Set to 'true' to enable CSRF protection (recommended for production)
                              # When enabled, all POST/PUT/DELETE/PATCH requests require X-CSRF-Token header
                              # GET requests are exempt (safe operations)
                              # Frontend automatically handles token fetch and injection

# Storage
STORAGE_DRIVER=disk # or azure
AZURE_STORAGE_ACCOUNT=<dev-account>
AZURE_STORAGE_CONTAINER=smartapply
AZURE_STORAGE_CONNECTION_STRING=<dev-conn-string>

# Jobs/Queue
SERVICE_BUS_CONNECTION_STRING=<sb-conn-string>
JOBS_PROVIDER=in-memory # or service-bus

# Azure Services
KEY_VAULT_URI=https://your-kv.vault.azure.net/
AZURE_OPENAI_ENDPOINT=https://your-aoai.openai.azure.com/
AZURE_OPENAI_API_KEY=<key>
AZURE_OPENAI_DEPLOYMENT_NAME=<deployment>

# PDF Generation
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# LLM Provider
LLM_PROVIDER=mock # or azure-openai or huggingface
```

### Frontend (apps/web/.env.local)
```bash
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
```


## Local Dev Commands

### Initial Setup
```bash
# Run setup script (installs deps, creates .env files, starts DB, runs migrations & seed)
chmod +x setup.sh
./setup.sh
```

### Backend (Terminal 1)
```bash
cd apps/api
npm run start:dev        # Start API at http://localhost:3000
npm run test:e2e         # Run E2E tests
npm run prisma:studio    # Open Prisma Studio GUI
```

### Frontend (Terminal 2)
```bash
cd apps/web
npm run dev              # Start Next.js at http://localhost:3001
npm run build            # Production build (validates TypeScript)
npm run lint             # ESLint check
npx shadcn@latest add <component>  # Add new shadcn/ui component
```

### Access URLs
- **Frontend:** http://localhost:3001
- **Backend API:** http://localhost:3000
- **Swagger Docs:** http://localhost:3000/docs
- **Prisma Studio:** http://localhost:5555

### Demo Login
- **Email:** demo@smartapply.com
- **Password:** Demo123!

## CI/CD (GitHub Actions with Azure OIDC)
- Build Docker image → push to **ACR**
- Deploy to **ACA** with container image
- Inject env via **Key Vault** references
- Post-deploy: run DB migrations (job/init container)

## Minimal Azure Resources (MVP)
- Resource Group, VNet (optional)
- **ACR**, **ACA**
- **Azure Database for PostgreSQL – Flexible Server**
- **Storage Account** (Blob)
- **Service Bus**
- **Key Vault**
- **Azure OpenAI** (deployment name in env)

## Tests
**Backend (apps/api)**
- E2E: Auth (register, login, me), Profile CRUD, Application pipeline (mock LLM + in-memory providers)
- Run: `cd apps/api && npm run test:e2e`

**Frontend (apps/web)**
- ESLint validation (TypeScript strict mode, no `any` types)
- Production build test (validates all pages compile)
- Run: `cd apps/web && npm run lint && npm run build`

## Current Status

### Backend (95% Complete) ✅
- Authentication with JWT + argon2 ✅
- Profile CRUD with all relations (Skills, Experiences, Education, Certificates, Projects, Languages) ✅
- Storage abstraction (Disk + Azure Blob providers) ✅
- LLM abstraction (Mock + Azure OpenAI + Hugging Face providers) ✅
- PDF generation (Puppeteer + Handlebars templates) ✅
- **ATS-optimized PDF generation** with selectable CSS templates ✅
- Jobs queue (In-Memory + Azure Service Bus providers) ✅
- Applications pipeline (create → queue → generate → upload → ready) ✅
- Security (Helmet, CORS, rate limiting, validation) ✅
- **Remaining:** File uploads endpoint, Health checks

### ATS-Optimized PDF Templates ✅
- **4 Professional CSS Templates:**
  - `modern-professional` - Clean, modern design with blue accents
  - `elegant-minimal` - Minimalist with subtle styling
  - `tech-modern` - Tech-focused with gradient accents
  - `executive-classic` - Traditional, serif-based professional look
- **ATS Compliance:**
  - Simple, parseable HTML structure
  - No tables, columns, or complex layouts
  - Standard fonts (Arial, system fonts)
  - Plain text skills (comma-separated, no badges)
  - Clear section headers (H2 tags)
  - Languages section with proficiency levels
- **Template Management:**
  - Templates stored in database (`ResumeTemplate` model)
  - Seeded via `npm run prisma:seed:templates`
  - User can select template per application

### Automatic Language Detection ✅
- **Intelligent Language Recognition:**
  - Analyzes job posting text for language markers (German/English keywords)
  - Scoring algorithm counts frequency of language-specific words
  - Detects 'de' (German) or 'en' (English) with fallback to English
- **Adaptive Content Generation:**
  - Cover letters automatically generated in detected language
  - Resumes adapt section headers and descriptions to match language
  - Technical terms (React, Docker, etc.) remain in English
- **Template Integration:**
  - Language code passed to LLM prompts as `{{language}}` and `{{languageName}}`
  - Templates include language-specific instructions and examples
  - Formal address adapts to language (Sie/du vs. you)
- **Testing:** Unit tests verify detection accuracy across various text samples
- **Documentation:** See `docs/features/AUTOMATIC_LANGUAGE_DETECTION.md`

### Frontend (35% Complete) 🔄
- **Implemented ✅**
  - Project setup (Next.js 14, 450 packages, 0 vulnerabilities)
  - Authentication pages (login, register with validation)
  - Dashboard layout (responsive navigation, mobile menu)
  - Dashboard page (stats cards, recent applications)
  - Landing page (hero, features, CTA)
  - API client (typed endpoints for all backend routes)
  - Auth store (Zustand with localStorage persistence)
  - React Query provider (server state management)
  - Custom hooks (useProfile, useApplications)

- **In Development ⏳**
  - Profile management forms (Issues #42-#47)
  - Job postings UI (Issues #48-#49)
  - Applications UI (Issues #50-#52)
  - PDF preview & editing (Issue #53)
  - Loading states & error handling (Issues #54-#55)

### Security (60% Complete) ⚠️
- **Critical:** JWT secret, CORS whitelist, HttpOnly cookies
- **High:** Password strength, rate limiting, CSRF, XSS, refresh tokens
- **Medium/Low:** CSP, security headers, audit logs, session management, 2FA
- See `MVP_FEATURES.md` for detailed security todos

## Roadmap (Post-MVP)
- **Security Hardening:** Fix critical issues (JWT secret, HttpOnly cookies, CSRF protection)
- **Frontend Completion:** Profile forms, Job postings UI, Applications UI, PDF preview/editing
- **Testing:** E2E tests for critical frontend flows
- **Deployment:** Azure Container Apps (backend) + Vercel/Azure SWA (frontend)
- **Future Features:**
  - SSE/Webhooks for real-time progress updates
  - Multi-tenant (organizations/workspaces)
  - Version history + manual edit blocks pre-PDF
  - Managed Identity instead of connection strings
  - Prometheus/Grafana via Dapr/ACA add-ons
  - ATS JSON export format
