# Smart Apply — Backend MVP (Azure)

## Goal
Deliver a minimal yet production-grade API that:
1) Stores a candidate profile (skills, certificates, experiences, projects)
2) Ingests job postings (text/URL/file → normalized)
3) Generates a tailored cover letter + resume via LLM
4) Exports both as PDFs stored in Azure Blob and retrievable via signed URLs (SAS)

## Non-Goals
- Full frontend (API-only)
- Rich document editing
- Multi-tenant complexity (single-tenant users/roles for MVP)

## Azure-first Tech Stack
- **NestJS (TypeScript)**, **Prisma + PostgreSQL**
  - Dev: Docker Postgres
  - Prod: **Azure Database for PostgreSQL – Flexible Server**
- **Containers/Runtime:** Docker; deploy to **Azure Container Apps (ACA)** (alt: App Service Linux)
- **Storage:** **Azure Blob Storage** (SAS for downloads)
- **Queues/Jobs:** **Azure Service Bus** for pipeline orchestration
- **Secrets:** **Azure Key Vault** (dev via `.env`)
- **LLM:** **Azure OpenAI** (pluggable provider + mock)
- **PDF:** Puppeteer/Chromium
- **Observability:** pino logs, `/health` endpoint (Nest Terminus)
- **Security:** argon2, Helmet, CORS whitelist, rate limit

## Modules
- `auth` (JWT, optional OAuth with Microsoft Entra)
- `profile`
- `uploads` (file → Blob in prod)
- `job-postings`
- `applications` (pipeline orchestration)
- `llm` (Azure OpenAI + mock)
- `pdf`
- `storage` (disk | azure-blob)
- `jobs` (service-bus)
- `config` (Zod env schema), `common` (filters/guards)

## Data Model
Use the previously defined Prisma models: **User**, **Profile**, **JobPosting**, **Application**.

## API (v1)
- `POST /auth/register` | `POST /auth/login` | `GET /auth/me`
- `GET /profile` | `PUT /profile`
- `POST /uploads`
- `POST /job-postings:parse`
- `POST /applications`
- `GET /applications/:id`
- `GET /applications/:id/files` (returns SAS URLs)

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
- JWT (access [+ optional refresh])
- Password hashing (argon2)
- Helmet, CORS allowlist, rate limit
- No PII in logs
- **Key Vault** for secrets in prod
- Short-TTL **SAS** for file downloads
- GDPR-friendly deletion (post-MVP ticket)

## Environment Variables (dev)
DATABASE_URL=postgresql://postgres:postgres@db:5432/smartapply
JWT_SECRET=change_me
STORAGE_DRIVER=azure # or disk
AZURE_STORAGE_ACCOUNT=<dev-account>
AZURE_STORAGE_CONTAINER=smartapply
AZURE_STORAGE_CONNECTION_STRING=<dev-conn-string>
SERVICE_BUS_CONNECTION_STRING=<sb-conn-string>
KEY_VAULT_URI=https://your-kv.vault.azure.net/

AZURE_OPENAI_ENDPOINT=https://your-aoai.openai.azure.com/

AZURE_OPENAI_API_KEY=<key>
AZURE_OPENAI_DEPLOYMENT_NAME=<deployment>
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium


## Local Dev Commands
- `docker compose up -d`
- `npx prisma migrate dev && npx prisma db seed`
- `npm run start:dev`
- `npm run test:e2e`
- Swagger at `/docs`

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
- E2E: Auth, Profile CRUD, Application pipeline (mock LLM + in-memory or ephemeral resources)

## Roadmap (post-MVP)
- SSE/Webhooks for progress updates
- Multi-tenant (organizations/workspaces)
- Version history + manual edit blocks pre-PDF
- Managed Identity instead of connection strings
- Prometheus/Grafana via Dapr/ACA add-ons
- ATS exports (PDF + JSON)
