# Smart Apply - System Architecture

## 🏗️ High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          Client Layer                            │
│                    (Future Frontend / API Consumers)             │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ HTTPS
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Azure Container Apps                         │
│                    (Load Balanced, Auto-Scale)                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    NestJS API (Node.js)                    │  │
│  │  ┌──────────┬──────────┬──────────┬──────────┬─────────┐  │  │
│  │  │   Auth   │ Profile  │   Jobs   │   LLM   │ Storage │  │  │
│  │  │  Module  │  Module  │  Module  │ Module  │ Module  │  │  │
│  │  └──────────┴──────────┴──────────┴──────────┴─────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
└────────────┬────────────┬────────────┬────────────┬─────────────┘
             │            │            │            │
    ┌────────┴────┐  ┌────┴────┐  ┌───┴────┐  ┌───┴──────┐
    │             │  │         │  │        │  │          │
    ▼             ▼  ▼         ▼  ▼        ▼  ▼          ▼
┌────────┐  ┌─────────────┐  ┌──────────┐  ┌────────────────┐
│ Azure  │  │   Azure     │  │  Azure   │  │ Azure Blob     │
│ Postgres│  │ Key Vault  │  │ Service  │  │ Storage        │
│ Flexible│  │            │  │   Bus    │  │                │
│ Server │  │ (Secrets)  │  │ (Jobs)   │  │ (Files/PDFs)   │
└────────┘  └─────────────┘  └──────────┘  └────────────────┘
                                                    │
                             ┌──────────────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  Azure OpenAI   │
                    │   (GPT-4/4o)    │
                    │  LLM Generation │
                    └─────────────────┘
```

## 📦 Module Architecture

### Core Modules

```
apps/api/src/
│
├── main.ts                    # Application entry point
├── app.module.ts              # Root module
│
├── config/                    # ✅ IMPLEMENTED
│   ├── env.schema.ts          # Zod validation
│   ├── config.service.ts      # Type-safe config access
│   └── config.module.ts       # Global config module
│
├── common/                    # ✅ IMPLEMENTED
│   ├── decorators/            # @Public, @CurrentUser
│   ├── filters/               # Global exception filter
│   └── guards/                # JWT auth guard
│
├── prisma/                    # ✅ IMPLEMENTED
│   ├── prisma.service.ts      # DB client singleton
│   └── prisma.module.ts       # Global DB module
│
├── auth/                      # ✅ IMPLEMENTED
│   ├── auth.controller.ts     # POST /register, /login, GET /me
│   ├── auth.service.ts        # JWT, password hashing
│   ├── strategies/            # JWT strategy
│   ├── dto/                   # RegisterDto, LoginDto
│   └── auth.module.ts
│
├── storage/                   # ✅ IMPLEMENTED
│   ├── storage.interface.ts   # Provider contract
│   ├── storage.service.ts     # Facade service
│   ├── providers/
│   │   ├── disk.provider.ts   # Local filesystem
│   │   └── azure-blob.provider.ts  # Azure Blob + SAS
│   └── storage.module.ts
│
├── llm/                       # ✅ IMPLEMENTED
│   ├── llm.interface.ts       # Provider contract
│   ├── llm.service.ts         # Template rendering
│   ├── providers/
│   │   ├── azure-openai.provider.ts  # Azure OpenAI
│   │   └── mock.provider.ts          # Testing mock
│   └── llm.module.ts
│
├── profile/                   # ✅ IMPLEMENTED
│   ├── profile.controller.ts  # GET/PUT /profile
│   ├── profile.service.ts     # CRUD + aggregation
│   ├── dto/                   # Update profile DTOs
│   └── profile.module.ts
│
├── uploads/                   # ⏳ TODO
│   ├── uploads.controller.ts  # POST /uploads
│   ├── uploads.service.ts     # File validation + storage
│   ├── dto/                   # Upload DTOs
│   └── uploads.module.ts
│
├── job-postings/              # ⏳ TODO
│   ├── job-postings.controller.ts  # POST /job-postings:parse
│   ├── job-postings.service.ts     # Parsing logic
│   ├── dto/                        # Parse DTOs
│   └── job-postings.module.ts
│
├── pdf/                       # ⏳ TODO
│   ├── pdf.service.ts         # Puppeteer HTML→PDF
│   └── pdf.module.ts
│
├── jobs/                      # ⏳ TODO
│   ├── jobs.service.ts        # Service Bus producer/consumer
│   ├── processors/            # Job handlers
│   └── jobs.module.ts
│
└── applications/              # ⏳ TODO
    ├── applications.controller.ts   # POST /, GET /:id, GET /:id/files
    ├── applications.service.ts      # Pipeline orchestration
    ├── dto/                         # Create application DTOs
    └── applications.module.ts
```

## 🔄 Application Generation Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                  User Creates Application                        │
│             POST /api/v1/applications                            │
│                 { jobPostingId: "..." }                          │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│               ApplicationsService                                │
│  1. Validate jobPosting exists                                  │
│  2. Create Application record (status: PENDING)                 │
│  3. Publish job to Service Bus queue                            │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│             Azure Service Bus Queue                              │
│               "application-jobs"                                 │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│               Job Processor (Worker)                             │
│  1. Update status → GENERATING                                  │
│  2. Load User Profile (skills, experience, etc.)                │
│  3. Load Job Posting (requirements, responsibilities)           │
│  4. Build context for LLM                                       │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                   LLM Service                                    │
│  1. Load template: prompts/cover-letter.md                      │
│  2. Render with context variables                               │
│  3. Call Azure OpenAI (or Mock)                                 │
│  4. Receive generated cover letter (Markdown)                   │
│                                                                  │
│  5. Load template: prompts/resume.md                            │
│  6. Render with context variables                               │
│  7. Call Azure OpenAI (or Mock)                                 │
│  8. Receive generated resume (Markdown)                         │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                   PDF Service                                    │
│  1. Convert cover letter Markdown → HTML                        │
│  2. Puppeteer: HTML → PDF (cover-letter.pdf)                   │
│  3. Convert resume Markdown → HTML                              │
│  4. Puppeteer: HTML → PDF (resume.pdf)                         │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│               Storage Service                                    │
│  1. Upload cover-letter.pdf → Azure Blob                        │
│  2. Get storage key: "12345-cover-letter.pdf"                  │
│  3. Upload resume.pdf → Azure Blob                              │
│  4. Get storage key: "12345-resume.pdf"                        │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│            Update Application Record                             │
│  - status → READY                                               │
│  - coverLetterFileKey: "12345-cover-letter.pdf"                │
│  - resumeFileKey: "12345-resume.pdf"                           │
│  - coverLetterText: <markdown>                                  │
│  - resumeText: <markdown>                                       │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│          User Requests Files                                     │
│       GET /api/v1/applications/:id/files                        │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│          Generate SAS URLs (time-limited)                        │
│  {                                                               │
│    coverLetter: "https://blob.../cover.pdf?sas=...",            │
│    resume: "https://blob.../resume.pdf?sas=..."                 │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘
```

## 🗄️ Database Schema

```
┌──────────────┐
│    User      │
│──────────────│
│ id (PK)      │
│ email        │◄─────┐
│ password     │      │
│ firstName    │      │
│ lastName     │      │
│ provider     │      │
│ providerId   │      │
└──────────────┘      │
                      │ 1:1
┌──────────────┐      │
│   Profile    │──────┘
│──────────────│
│ id (PK)      │
│ userId (FK)  │
│ summary      │
│ phone        │
│ location     │
│ linkedinUrl  │
│ portfolioUrl │
└──┬───┬───┬───┘
   │   │   │
   │   │   │ 1:N
   │   │   └─────┐
   │   │         │
   │   │ 1:N     │        ┌──────────────┐
   │   └─────┐   │        │   Project    │
   │         │   │        │──────────────│
   │ 1:N     │   └───────►│ id (PK)      │
   │         │            │ profileId(FK)│
   │         │            │ name         │
   │         │            │ description  │
   │         │            │ url          │
   │         │            │ technologies │
   │         │            │ highlights   │
   │         │            └──────────────┘
   │         │
   │         │   ┌──────────────┐
   │         │   │ Certificate  │
   │         │   │──────────────│
   │         └──►│ id (PK)      │
   │             │ profileId(FK)│
   │             │ name         │
   │             │ issuer       │
   │             │ issueDate    │
   │             │ expiryDate   │
   │             └──────────────┘
   │
   │             ┌──────────────┐
   │             │  Experience  │
   │             │──────────────│
   └────────────►│ id (PK)      │
                 │ profileId(FK)│
                 │ title        │
                 │ company      │
                 │ startDate    │
                 │ endDate      │
                 │ description  │
                 │ achievements │
                 └──────────────┘

┌──────────────────┐
│   JobPosting     │
│──────────────────│
│ id (PK)          │◄────┐
│ title            │     │
│ company          │     │
│ description      │     │
│ requirements     │     │
│ responsibilities │     │
│ rawText          │     │
│ sourceUrl        │     │
└──────────────────┘     │
                         │ N:1
┌──────────────────┐     │
│   Application    │─────┘
│──────────────────│
│ id (PK)          │
│ userId (FK)      │
│ jobPostingId(FK) │
│ status           │  ← PENDING | GENERATING | READY | FAILED
│ coverLetterText  │
│ resumeText       │
│ coverLetterKey   │  ← Azure Blob key
│ resumeKey        │  ← Azure Blob key
│ errorMessage     │
└──────────────────┘
```

## 🔐 Security Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Request Flow                              │
└─────────────────────────────────────────────────────────────────┘

Request
  │
  ├─► Helmet (Security Headers)
  │     ├─ X-Frame-Options
  │     ├─ X-Content-Type-Options
  │     ├─ X-XSS-Protection
  │     └─ Strict-Transport-Security
  │
  ├─► CORS Validation
  │     └─ Check origin against whitelist
  │
  ├─► Rate Limiting (ThrottlerGuard)
  │     └─ 100 requests / 60 seconds (configurable)
  │
  ├─► Body Size Limit
  │     └─ Prevent DoS attacks
  │
  ├─► JWT Authentication (if not @Public)
  │     ├─ Extract Bearer token
  │     ├─ Verify signature
  │     ├─ Check expiration
  │     └─ Load user from database
  │
  ├─► Input Validation (ValidationPipe)
  │     ├─ DTO validation (class-validator)
  │     ├─ Whitelist properties
  │     └─ Transform types
  │
  ├─► Business Logic
  │     └─ Execute service methods
  │
  └─► Response
        └─ Sanitized output (no sensitive data)
```

### Secrets Management

**Development:**
- `.env` file (never committed)
- Local environment variables

**Production:**
```
Azure Key Vault
├── database-url          (PostgreSQL connection string)
├── jwt-secret            (JWT signing key)
├── storage-connection    (Azure Blob connection)
├── service-bus-connection (Service Bus connection)
├── openai-endpoint       (Azure OpenAI endpoint)
└── openai-api-key        (Azure OpenAI key)
         │
         │ Managed Identity
         │ (No connection strings in code!)
         ▼
   Container App
   ├── Env vars reference Key Vault
   └── System-assigned identity has access
```

## 🚀 Deployment Architecture

```
GitHub Repository
  │
  │ git push main
  ▼
GitHub Actions
  │
  ├─► Azure Login (OIDC - NO SECRETS!)
  │     └─ Federated credential authentication
  │
  ├─► Build Docker Image
  │     ├─ Multi-stage build
  │     ├─ Chromium installation
  │     └─ Production optimizations
  │
  ├─► Push to Azure Container Registry
  │     └─ Tag: latest + git SHA
  │
  ├─► Run Database Migrations
  │     └─ npx prisma migrate deploy
  │
  └─► Deploy to Container Apps
        ├─ Pull image from ACR
        ├─ Inject env vars (Key Vault refs)
        ├─ Create new revision
        └─ Traffic split: 0% → 100%
              │
              ▼
        Azure Container Apps
        ├── Auto-scaling (1-3 replicas)
        ├── Health checks
        ├── Ingress (HTTPS)
        └── Managed identity for Azure services
```

## 📊 Data Flow Examples

### 1. User Registration
```
Client → POST /auth/register { email, password }
  → AuthController
  → AuthService.register()
  → Check if user exists (Prisma)
  → Hash password (argon2)
  → Create user (Prisma)
  → Generate JWT
  → Return { user, accessToken }
```

### 2. File Upload
```
Client → POST /uploads (multipart/form-data)
  → UploadsController
  → Validate file (type, size)
  → StorageService.uploadFile()
  → AzureBlobProvider.upload()
  → Save to blob storage
  → Return { fileId, url }
```

### 3. Generate Application
```
Client → POST /applications { jobPostingId }
  → ApplicationsController
  → ApplicationsService.create()
  → Create record (status: PENDING)
  → JobsService.publishJob()
  → Azure Service Bus queue
  
Worker consumes message:
  → ProfileService.getProfile()
  → JobPostingsService.getJobPosting()
  → LLMService.generateCoverLetter()
  → LLMService.generateResume()
  → PdfService.generatePDF() × 2
  → StorageService.uploadFile() × 2
  → Update application (status: READY)
```

## 🔧 Technology Decisions

| Requirement | Technology | Rationale |
|-------------|-----------|-----------|
| Runtime | Node.js 20 | LTS, async I/O, TypeScript support |
| Framework | NestJS | Enterprise-grade, modular, TypeScript-first |
| Database | PostgreSQL 16 | Relational, JSON support, Azure native |
| ORM | Prisma | Type-safe, migrations, modern DX |
| Auth | JWT + argon2 | Stateless, secure password hashing |
| Storage | Azure Blob | Scalable object storage, SAS support |
| Queue | Azure Service Bus | Reliable messaging, dead-letter queues |
| LLM | Azure OpenAI | Enterprise-grade, GPT-4/4o access |
| PDF | Puppeteer | Headless Chrome, HTML → PDF |
| Container | Docker | Portable, Azure Container Apps native |
| CI/CD | GitHub Actions | OIDC support, marketplace actions |
| Secrets | Azure Key Vault | Managed, auditable, Managed Identity |

## 📈 Scalability Considerations

### Horizontal Scaling
- **Container Apps**: Auto-scale 1-3 replicas based on HTTP requests
- **Database**: Connection pooling via Prisma
- **Service Bus**: Multiple workers can consume from queue

### Performance Optimizations
- **Caching**: Redis can be added for session/data caching
- **CDN**: Azure CDN for static content (PDFs)
- **Database**: Indexes on frequently queried fields
- **Async Processing**: Heavy tasks (PDF, LLM) in background

### Monitoring (Future)
- **Application Insights**: Request tracing, error tracking
- **Log Analytics**: Centralized logging
- **Alerts**: Failed jobs, high error rates
- **Metrics**: Response times, queue depth

---

This architecture provides a solid foundation for a production-ready MVP that can scale to thousands of users while maintaining security, reliability, and developer experience.
