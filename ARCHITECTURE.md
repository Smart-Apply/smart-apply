# Smart Apply - System Architecture

## 🏗️ High-Level Architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│                      Next.js Frontend                           │
│                  (React 19, Tailwind, shadcn/ui)                │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ HTTPS (Port 3001)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Azure Container Apps                         │
│                    (Load Balanced, Auto-Scale)                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    NestJS API (Port 3000)                  │  │
│  │  ┌───────┬──────────┬────────┬────────┬────────┬───────┐  │  │
│  │  │ Auth  │ Profile  │  Jobs  │  LLM   │Storage │  PDF  │  │  │
│  │  └───────┴──────────┴────────┴────────┴────────┴───────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
└────────────┬────────────┬────────────┬────────────┬─────────────┘
             │            │            │            │
    ┌────────┴────┐  ┌────┴────┐  ┌───┴────┐  ┌───┴──────┐
    ▼             ▼  ▼         ▼  ▼        ▼  ▼          ▼
┌────────┐  ┌─────────────┐  ┌──────────┐  ┌────────────────┐
│ Azure  │  │   Azure     │  │  Azure   │  │ Azure Blob     │
│PostgreSQL│ │ Key Vault  │  │ Service  │  │ Storage        │
│ Flexible│  │            │  │   Bus    │  │                │
│ Server │  │ (Secrets)   │  │ (Queue)  │  │ (PDFs/Files)   │
└────────┘  └─────────────┘  └──────────┘  └────────────────┘
                                                    │
                             ┌──────────────────────┘
                             ▼
                    ┌─────────────────┐
                    │ Azure AI Foundry│
                    │  + Azure OpenAI │
                    │  (GPT-4o)       │
                    └─────────────────┘
```

## 📦 Monorepo Structure (npm Workspaces)

```text
smart-apply/
├── package.json              # Workspace Root
├── turbo.json                # Turborepo Config
├── apps/
│   ├── api/                  # @smart-apply/api (NestJS)
│   │   ├── src/
│   │   │   ├── admin/        # Admin Module
│   │   │   ├── agents/       # Azure AI Agents
│   │   │   ├── applications/ # Application Pipeline
│   │   │   ├── auth/         # JWT + Sessions
│   │   │   ├── common/       # Guards, Filters
│   │   │   ├── config/       # Env Config (Zod)
│   │   │   ├── health/       # Health Checks
│   │   │   ├── job-postings/ # Job Parser
│   │   │   ├── jobs/         # Queue Processing
│   │   │   ├── keywords/     # ATS Keywords
│   │   │   ├── llm/          # LLM Providers
│   │   │   ├── pdf/          # PDF Generation
│   │   │   ├── prisma/       # Database Client
│   │   │   ├── profile/      # Profile CRUD
│   │   │   ├── resume-parser/# Resume Parser
│   │   │   ├── storage/      # File Storage
│   │   │   ├── templates/    # Template System
│   │   │   ├── uploads/      # File Uploads
│   │   │   └── user-preferences/
│   │   ├── prisma/           # Schema + Migrations
│   │   └── test/             # E2E + Unit Tests
│   │
│   └── web/                  # @smart-apply/web (Next.js)
│       ├── src/
│       │   ├── app/          # App Router Pages
│       │   ├── components/   # UI Components
│       │   ├── hooks/        # Custom Hooks
│       │   ├── lib/          # API Client, Utils
│       │   ├── stores/       # Zustand Stores
│       │   └── types/        # TypeScript Types
│       └── public/           # Static Assets
│
├── packages/
│   └── shared/               # Shared Types/Utils
│
├── docs/                     # Documentation
└── infra/                    # Docker, Deployment
```

## 🔄 Application Generation Pipeline

```text
User → Frontend (Next.js)
        │
        │ POST /api/v1/applications
        ▼
┌──────────────────────────────┐
│ ApplicationsService          │
│ 1. Validate job posting      │
│ 2. Create record (PENDING)   │
│ 3. Publish to queue          │
└──────────────────────────────┘
        │
        ▼
┌──────────────────────────────┐
│ Service Bus Queue            │
│ "application-jobs"           │
└──────────────────────────────┘
        │
        ▼
┌──────────────────────────────┐
│ Job Processor                │
│ 1. Update status → GENERATING│
│ 2. Load Profile + Job        │
│ 3. Detect Language           │
│ 4. Select Template           │
└──────────────────────────────┘
        │
        ▼
┌──────────────────────────────┐
│ LLM Service (Azure OpenAI)   │
│ 1. Generate Cover Letter     │
│ 2. Generate Resume           │
└──────────────────────────────┘
        │
        ▼
┌──────────────────────────────┐
│ PDF Service (Puppeteer)      │
│ 1. Render Handlebars Template│
│ 2. Generate PDFs             │
│ 3. ATS-optimized Output      │
└──────────────────────────────┘
        │
        ▼
┌──────────────────────────────┐
│ Storage Service (Azure Blob) │
│ 1. Upload PDFs               │
│ 2. Generate SAS URLs         │
│ 3. Update status → READY     │
└──────────────────────────────┘
        │
        ▼
┌──────────────────────────────┐
│ SSE (Real-time Updates)      │
│ Push status to Frontend      │
└──────────────────────────────┘
```

## 🗄️ Database Schema (Prisma)

### Core Models

| Model             | Description                            |
| ----------------- | -------------------------------------- |
| **User**          | Authentication, email, password        |
| **Profile**       | Personal info, contact details         |
| **Skill**         | Skills with level                      |
| **Experience**    | Work history                           |
| **Education**     | Education history                      |
| **Certificate**   | Certifications                         |
| **Project**       | Portfolio projects                     |
| **Language**      | Language proficiency                   |
| **JobPosting**    | Parsed job listings                    |
| **Application**   | Generated applications                 |
| **ResumeTemplate**| PDF templates                          |
| **RefreshToken**  | Token rotation                         |
| **Session**       | Device tracking                        |

### Key Relations

```text
User 1:1 Profile
Profile 1:N Skills, Experiences, Education, Certificates, Projects, Languages
User 1:N JobPostings
User 1:N Applications
Application N:1 JobPosting
Application N:1 ResumeTemplate
User 1:N RefreshTokens
User 1:N Sessions
```

## 🔐 Security Architecture

### Authentication Flow

```text
1. Login → JWT Access Token (HttpOnly Cookie, 15min)
         → Refresh Token (HttpOnly Cookie, 7 days)
2. Access Token expires → Auto-refresh via /auth/refresh
3. Refresh Token rotation on each use
4. Max 5 concurrent sessions per user
5. Remote logout capability
```

### Security Layers

| Layer          | Implementation                         |
| -------------- | -------------------------------------- |
| **Transport**  | HTTPS, HSTS                            |
| **Headers**    | Helmet, CSP, X-Frame-Options           |
| **Auth**       | JWT + HttpOnly Cookies                 |
| **Rate Limit** | 5/15min (auth), 100/15min (standard)   |
| **Input**      | class-validator, @Sanitize() decorator |
| **XSS**        | DOMPurify, CSP                         |
| **CSRF**       | Optional csrf-csrf                     |
| **Passwords**  | argon2, strength validation            |
| **Audit**      | Winston logging, 90-day retention      |

## 🔧 Technology Stack

### Backend (NestJS 11)

| Category   | Technology                       |
| ---------- | -------------------------------- |
| Runtime    | Node.js 24                       |
| Framework  | NestJS 11                        |
| Database   | PostgreSQL 16                    |
| ORM        | Prisma 5.22                      |
| Auth       | JWT (jsonwebtoken) + argon2      |
| Queue      | Azure Service Bus                |
| Storage    | Azure Blob Storage               |
| LLM        | Azure AI Foundry + Azure OpenAI  |
| PDF        | Puppeteer 24 + Handlebars        |
| Validation | class-validator, Zod             |

### Frontend (Next.js 16)

| Category   | Technology                       |
| ---------- | -------------------------------- |
| Framework  | Next.js 16.1 (App Router)        |
| Language   | TypeScript (strict)              |
| UI         | React 19 + shadcn/ui + Tailwind  |
| State      | Zustand (auth) + React Query     |
| Forms      | React Hook Form + Zod            |
| PDF Viewer | react-pdf                        |
| Editor     | Tiptap                           |
| Toast      | Sonner                           |

### Infrastructure

| Category   | Technology                       |
| ---------- | -------------------------------- |
| Container  | Docker (multi-stage)             |
| Hosting    | Azure Container Apps             |
| CI/CD      | GitHub Actions (OIDC)            |
| Secrets    | Azure Key Vault                  |
| Monitoring | Winston logs                     |

## 📊 API Endpoints

### Public Endpoints

| Method | Endpoint         | Description        |
| ------ | ---------------- | ------------------ |
| POST   | `/auth/register` | User registration  |
| POST   | `/auth/login`    | User login         |
| POST   | `/auth/refresh`  | Token refresh      |
| GET    | `/health`        | Health check       |

### Protected Endpoints

| Method   | Endpoint                  | Description         |
| -------- | ------------------------- | ------------------- |
| GET      | `/auth/me`                | Current user        |
| GET      | `/auth/logout`            | Logout              |
| GET/PUT  | `/profile`                | Profile CRUD        |
| GET/POST | `/job-postings`           | Job management      |
| POST     | `/job-postings/parse`     | Parse job URL       |
| GET/POST | `/applications`           | Applications        |
| GET      | `/applications/:id/files` | PDF downloads       |
| GET      | `/templates`              | Available templates |
| GET      | `/sessions`               | Active sessions     |

## 🚀 Deployment

### Development

```bash
# Start everything
npm run dev

# Or individually
npm run api:dev    # Backend on :3000
npm run web:dev    # Frontend on :3001
```

### Production (Azure)

```text
GitHub Actions → Build Docker → Push ACR → Deploy ACA
                                              │
                                              ├── API Container
                                              ├── PostgreSQL Flexible
                                              ├── Blob Storage
                                              ├── Service Bus
                                              └── Key Vault
```

## 📈 Performance Optimizations

| Feature            | Implementation                |
| ------------------ | ----------------------------- |
| **Template Cache** | In-memory cache (5min TTL)    |
| **Browser Pool**   | Puppeteer instance pooling    |
| **Circuit Breaker**| LLM failure protection        |
| **DB Indexes**     | Optimized query performance   |
| **Compression**    | gzip middleware               |
| **Pagination**     | Cursor-based pagination       |
| **SSE**            | Real-time status updates      |

---

**Current Status:** 96% Complete - Ready for Beta Testing

See [docs/guides/MVP_EVALUATION_DEC_2025.md](docs/guides/MVP_EVALUATION_DEC_2025.md) for detailed status.
