# Smart Apply — Full-Stack MVP (Azure)

## Goal
Deliver a minimal yet production-grade application with:
1) **Frontend (Next.js 14)**: User authentication, profile management, job posting input, application dashboard with PDF preview/editing
2) **Backend API (NestJS)**: Stores candidate profile (skills, certificates, experiences, projects), ingests job postings (text/URL/file → normalized), generates tailored cover letter + resume via LLM
3) **PDF Generation**: Exports both as PDFs stored in Azure Blob and retrievable via signed URLs (SAS)

## Non-Goals
- Rich document editing (basic Tiptap editor only)
- Multi-tenant complexity (single-tenant users/roles for MVP)
- Mobile app (responsive web only)

## Azure-first Tech Stack

### Backend (Port 3000)
- **NestJS v10 (TypeScript)**, **Prisma v5 + PostgreSQL**
  - Dev: Docker Postgres
  - Prod: **Azure Database for PostgreSQL – Flexible Server**
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
- `profile` (CRUD with Skills, Experiences, Education, Certificates, Projects)
- `uploads` (file → Blob in prod)
- `job-postings` (parse text/URL/file → normalized JobPosting)
- `applications` (pipeline orchestration: profile + job → LLM → PDF → Blob)
- `llm` (Azure OpenAI + Hugging Face + mock providers)
- `pdf` (Puppeteer + Handlebars templates)
- `storage` (disk | azure-blob providers)
- `jobs` (in-memory | service-bus providers)
- `config` (Zod env schema), `common` (filters/guards/decorators)

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
**Authentication** (Public)
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login (returns JWT + user)
- `GET /api/v1/auth/me` - Get current user (Protected)

**Profile** (Protected with JwtAuthGuard)
- `GET /api/v1/profile` - Get user profile with relations
- `PUT /api/v1/profile` - Update profile (name, phone, location, summary)
- `POST /api/v1/profile/skills` - Add skill
- `DELETE /api/v1/profile/skills/:id` - Remove skill
- `POST /api/v1/profile/experiences` - Add experience
- `PUT /api/v1/profile/experiences/:id` - Update experience
- `DELETE /api/v1/profile/experiences/:id` - Delete experience
- `POST /api/v1/profile/education` - Add education
- `PUT /api/v1/profile/education/:id` - Update education
- `DELETE /api/v1/profile/education/:id` - Delete education
- `POST /api/v1/profile/certificates` - Add certificate
- `PUT /api/v1/profile/certificates/:id` - Update certificate
- `DELETE /api/v1/profile/certificates/:id` - Delete certificate
- `POST /api/v1/profile/projects` - Add project
- `PUT /api/v1/profile/projects/:id` - Update project
- `DELETE /api/v1/profile/projects/:id` - Delete project

**Uploads** (Protected)
- `POST /api/v1/uploads` - Upload file (returns file key)

**Job Postings** (Protected)
- `POST /api/v1/job-postings/parse` - Parse job posting (text/URL/file → normalized)
- `GET /api/v1/job-postings` - List user's job postings
- `GET /api/v1/job-postings/:id` - Get job posting details
- `DELETE /api/v1/job-postings/:id` - Delete job posting

**Applications** (Protected)
- `POST /api/v1/applications` - Create application (triggers pipeline)
- `GET /api/v1/applications` - List user's applications
- `GET /api/v1/applications/:id` - Get application details
- `GET /api/v1/applications/:id/files` - Get PDF download URLs (SAS)

## Application Pipeline
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

### Current Security (6/10 Score)
**Implemented ✅**
- JWT authentication with JwtAuthGuard on all protected endpoints
- Password hashing with argon2 (memory-hard, ASIC-resistant)
- Helmet security headers (XSS, clickjacking, MIME sniffing protection)
- CORS with configurable origins and credentials support
- ThrottlerGuard rate limiting (global protection)
- Input validation with class-validator DTOs (whitelist + forbidNonWhitelisted)
- No PII in logs

**Critical Issues 🔴 (Must fix before production)**
- JWT secret uses weak default in .env.example ("change_me...")
- CORS allows all origins in dev (origin: true)
- JWT token stored in localStorage (XSS vulnerable, should use HttpOnly cookies)

**High Priority 🟡 (Should fix before launch)**
- No password strength validation (regex for complexity)
- Rate limiting too lenient on auth endpoints (should be 5 attempts/15min)
- No CSRF protection on POST/PUT/DELETE endpoints
- No input sanitization (should use DOMPurify frontend + validator backend)
- No refresh token strategy (only access tokens)

**Medium/Low Priority 🟢 (Post-launch)**
- Content Security Policy (CSP) headers
- Frontend security headers in next.config.ts
- Audit logging for failed logins and suspicious activity
- Session management (force logout, concurrent session limits)
- Two-factor authentication (2FA)
- **Key Vault** for secrets in prod
- Short-TTL **SAS** for file downloads
- GDPR-friendly deletion (post-MVP ticket)

**Security Roadmap**
See `MVP_FEATURES.md` for detailed security tasks with priorities and estimates.

## Environment Variables

### Backend (apps/api/.env)
```bash
DATABASE_URL=postgresql://postgres:postgres@db:5432/smartapply
JWT_SECRET=REPLACE_WITH_SECURE_RANDOM_SECRET_MINIMUM_64_CHARACTERS_USE_OPENSSL_RAND_BASE64_64
STORAGE_DRIVER=disk # or azure
AZURE_STORAGE_ACCOUNT=<dev-account>
AZURE_STORAGE_CONTAINER=smartapply
AZURE_STORAGE_CONNECTION_STRING=<dev-conn-string>
SERVICE_BUS_CONNECTION_STRING=<sb-conn-string>
KEY_VAULT_URI=https://your-kv.vault.azure.net/
AZURE_OPENAI_ENDPOINT=https://your-aoai.openai.azure.com/
AZURE_OPENAI_API_KEY=<key>
AZURE_OPENAI_DEPLOYMENT_NAME=<deployment>
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
LLM_PROVIDER=mock # or azure-openai or huggingface
JOBS_PROVIDER=in-memory # or service-bus
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

### Backend (90% Complete) ✅
- Authentication with JWT + argon2 ✅
- Profile CRUD with all relations (Skills, Experiences, Education, Certificates, Projects) ✅
- Storage abstraction (Disk + Azure Blob providers) ✅
- LLM abstraction (Mock + Azure OpenAI + Hugging Face providers) ✅
- PDF generation (Puppeteer + Handlebars templates) ✅
- Jobs queue (In-Memory + Azure Service Bus providers) ✅
- Applications pipeline (create → queue → generate → upload → ready) ✅
- Security (Helmet, CORS, rate limiting, validation) ✅
- **Remaining:** Job postings parser, File uploads endpoint, Health checks

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
  - ATS exports (PDF + JSON)
