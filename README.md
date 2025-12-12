# Smart Apply - AI-Powered Job Application Assistant

Production-grade full-stack MVP built with **TypeScript**, **NestJS**, **Next.js**, and **Azure** services.

> **🆕 New: npm Workspaces Monorepo Structure** - Clean separation of backend and frontend with optimized dependency management.

## 📦 What's New in This Version

The project has been restructured as a proper **npm Workspaces monorepo**:

- **Workspace Architecture**: Root package.json orchestrates `@smart-apply/api` and `@smart-apply/web` workspaces
- **Optimized Dependencies**: Shared dependencies (1.2GB) in root, workspace-specific deps in each app (5MB + 3.8MB)
- **Simplified Commands**: Run both apps with `npm run dev`, or individually with `npm run api:dev` / `npm run web:dev`
- **Better Organization**: Tests restructured into `test/e2e/` and `test/unit/` folders, docs organized into 6 categories
- **Faster Development**: Workspace symlinks enable cross-app imports, faster IDE indexing, and cleaner deployments

See [`docs/guides/MONOREPO_WORKSPACE.md`](docs/guides/MONOREPO_WORKSPACE.md) for detailed workspace documentation.

## 🎯 Overview

Smart Apply is an intelligent job application assistant that:

- Stores candidate profiles (skills, certificates, experiences, projects)
- Ingests job postings from text, URLs, or uploaded files
- **Agent-based URL parsing** for JavaScript-heavy job sites (Indeed, LinkedIn, Glassdoor)
- Generates tailored cover letters and resumes using AI
- Exports professional PDFs stored in Azure Blob Storage

### ✨ Key Features

- **Smart Job Parsing**: Two-tier fallback strategy
  - Fast static HTML parsing with Cheerio (< 1s)
  - Intelligent agent-based parsing with Playwright + LLM for dynamic sites (< 30s)
  - Supports Indeed, LinkedIn, Glassdoor, Monster, and more
- **Profile Management**: Store skills, experiences, education, certificates, projects
- **AI-Powered Content**: Generate tailored cover letters and resumes
- **Multi-Provider Architecture**: Flexible storage, LLM, and queue providers
- **Production-Ready**: JWT auth, rate limiting, health checks, containerized deployment

## 🏗️ Architecture

### Tech Stack

#### Backend (apps/api - Port 3000)

- **Framework**: NestJS (TypeScript)
- **Database**: PostgreSQL (Docker for dev, Azure Database for PostgreSQL in prod)
- **ORM**: Prisma
- **Caching**: In-memory (node-cache) for templates, Redis-ready for production scaling
- **Storage**: Azure Blob Storage (disk in dev)
- **Queue/Jobs**: Azure Service Bus
- **LLM**: Azure AI Foundry Agents, Azure OpenAI, Hugging Face (with mock provider for tests)
- **Job Parsing**: Playwright + Cheerio (agent-based URL parsing for dynamic sites)
- **PDF**: Puppeteer (Chromium)
- **Auth**: JWT + optional OAuth (Microsoft Entra ID, Google)
- **Secrets**: Azure Key Vault (dev via `.env`)
- **Container Runtime**: Docker, Azure Container Apps (or App Service)

#### Frontend (apps/web - Port 3001)

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **UI Library**: shadcn/ui (Radix UI primitives)
- **State Management**: Zustand (auth) + React Query (server state)
- **Forms**: React Hook Form + Zod validation
- **PDF Handling**: react-pdf + pdfjs-dist
- **Rich Text**: Tiptap editor
- **Icons**: Lucide React
- **Notifications**: Sonner toasts

### 🆕 Monorepo Structure (npm Workspaces)

```text
smart-apply/
├── package.json                   # 🆕 Workspace Root (Orchestrator)
├── node_modules/                  # Shared dependencies (1.2GB)
│   └── @smart-apply/              # Workspace symlinks
│       ├── api -> ../../apps/api
│       └── web -> ../../apps/web
├── apps/
│   ├── api/                       # Backend Workspace (@smart-apply/api)
│   │   ├── package.json           # 🆕 Backend dependencies (67 packages)
│   │   ├── node_modules/          # Backend-specific deps (5.0MB)
│   │   ├── src/
│   │   │   ├── auth/              # JWT authentication + sessions
│   │   │   ├── config/            # Environment configuration (Zod)
│   │   │   ├── common/            # Guards, filters, interceptors
│   │   │   ├── prisma/            # Database client
│   │   │   ├── storage/           # Disk + Azure Blob providers
│   │   │   ├── llm/               # Azure AI Foundry + OpenAI + Hugging Face + Mock
│   │   │   ├── pdf/               # PDF generation (Puppeteer)
│   │   │   ├── templates/         # Template system (7 templates)
│   │   │   ├── jobs/              # Service Bus integration
│   │   │   ├── profile/           # Profile CRUD
│   │   │   ├── uploads/           # File uploads
│   │   │   ├── job-postings/      # Job parsing (Agent + Cheerio)
│   │   │   ├── applications/      # Application pipeline
│   │   │   ├── app.module.ts
│   │   │   └── main.ts
│   │   ├── prisma/
│   │   │   ├── schema.prisma      # Database schema
│   │   │   ├── seed.ts            # Sample data
│   │   │   └── seed-templates.ts  # Template seeding
│   │   └── test/                  # 🆕 Organized test structure
│   │       ├── e2e/               # E2E tests (14 files)
│   │       │   ├── auth/          # Auth tests (3)
│   │       │   ├── features/      # Feature tests (4)
│   │       │   └── security/      # Security tests (6)
│   │       ├── unit/              # Unit tests
│   │       ├── fixtures/          # Test fixtures
│   │       └── README.md          # Test documentation
│   │
│   └── web/                       # Frontend Workspace (@smart-apply/web)
│       ├── package.json           # 🆕 Frontend dependencies (38 packages)
│       ├── node_modules/          # Frontend-specific deps (3.8MB)
│       ├── src/
│       │   ├── app/
│       │   │   ├── (auth)/        # Login, Register pages
│       │   │   ├── (dashboard)/   # Dashboard layout + pages
│       │   │   │   ├── dashboard/ # Stats & recent applications
│       │   │   │   ├── profile/   # Profile management (view + edit)
│       │   │   │   ├── jobs/      # Job postings list
│       │   │   │   ├── applications/ # Applications (list + detail + wizard)
│       │   │   │   └── settings/  # Settings & session management
│       │   │   ├── layout.tsx     # Root layout with Providers
│       │   │   └── page.tsx       # Landing page
│       │   ├── components/
│       │   │   ├── ui/            # shadcn/ui components (13)
│       │   │   └── forms/         # Form components (ProfileManagers, Wizard)
│       │   ├── hooks/             # Custom hooks (useProfile, useApplications)
│       │   ├── stores/            # Zustand stores (auth with persistence)
│       │   ├── lib/
│       │   │   ├── api-client.ts  # Typed API client (with CSRF)
│       │   │   ├── providers.tsx  # React Query + Toaster
│       │   │   └── utils.ts       # Helper functions
│       │   └── types/             # TypeScript types
│       ├── .env.local             # Frontend environment variables
│       └── public/                # Static assets
│
├── docs/                          # 🆕 Organized documentation
│   ├── README.md                  # Documentation index
│   ├── security/                  # Security docs (7 files)
│   ├── features/                  # Feature docs (5 files)
│   ├── implementation/            # Implementation docs (5 files)
│   ├── guides/                    # User guides (4 files)
│   │   ├── MVP_EVALUATION.md      # 🆕 MVP status & roadmap
│   │   ├── MONOREPO_WORKSPACE.md  # 🆕 Workspace documentation
│   │   └── TEMPLATE_GUIDE.md      # 🆕 Template system guide
│   ├── scripts/                   # Utility scripts
│   └── archive/                   # Historical docs
│
├── infra/
│   ├── docker-compose.yml         # Local development
│   └── Dockerfile                 # Multi-stage build
├── prompts/
│   ├── cover-letter.md            # Cover letter prompt
│   ├── resume.md                  # Resume prompt
│   └── extract-job-posting.md     # Job parsing prompt
├── .github/
│   ├── copilot-instructions.md    # Copilot instructions (updated)
│   └── workflows/
│       └── azure-deploy.yml       # CI/CD pipeline
└── .env.example                   # Environment template
```

**Key Changes:**

- 🆕 **Workspace-based Monorepo**: Clean separation with npm workspaces
- 🆕 **Dedicated package.json**: Both `apps/api` and `apps/web` have their own
- 🆕 **Optimized Dependencies**: Shared (1.2GB) + API-specific (5MB) + Web-specific (3.8MB)
- 🆕 **Organized Tests**: Tests moved to `apps/api/test/` with categories
- 🆕 **Comprehensive Docs**: `docs/` folder with 6 categories

## 🚀 Local Development

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- npm or yarn

### Quick Start

#### Backend Setup

1. **Clone and install dependencies**

```bash
npm install
```

2. **Set up environment variables**

```bash
cp .env.example .env
# Edit .env with your local configuration
```

3. **Start PostgreSQL with Docker Compose**

```bash
docker compose -f infra/docker-compose.yml up -d db
```

4. **Run database migrations and seed**

```bash
npm run prisma:migrate
npm run prisma:seed
```

5. **Start the API**

```bash
cd apps/api
npm run start:dev
```

#### Frontend Setup

1. **Navigate to frontend directory**

```bash
cd apps/web
```

2. **Install dependencies** (if not already done)

```bash
npm install
```

3. **Configure environment variables**

```bash
# Create .env.local file
echo "NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1" > .env.local
```

4. **Start the frontend**

```bash
npm run dev
```

#### Access the Application

- **Frontend**: <http://localhost:3001>
- **Backend API**: <http://localhost:3000/api/v1>
- **Swagger Docs**: <http://localhost:3000/docs>
- **Health Check**: <http://localhost:3000/api/v1/health>

### Development Commands

#### 🆕 Workspace Commands (Run from Root)

```bash
# Start both apps in parallel
npm run dev                # Starts API (3000) + Web (3001)

# Individual app commands
npm run api:dev            # Start API only
npm run web:dev            # Start web only
npm run api:build          # Build API
npm run web:build          # Build web

# Database commands (workspace-aware)
npm run prisma:generate    # Generate Prisma Client
npm run prisma:migrate     # Run migrations
npm run prisma:seed        # Seed sample data
npm run prisma:studio      # Open Prisma Studio

# Workspace management
npm install <pkg> --workspace=apps/api   # Install to API workspace
npm install <pkg> --workspace=apps/web   # Install to Web workspace
npm install -D <pkg>                     # Install to root (shared)
```

#### Backend (apps/api)

```bash
cd apps/api

# Development
npm run start:dev          # Start with hot reload (Port 3000)
npm run prisma:studio      # Open Prisma Studio (DB GUI)

# Database
npm run prisma:generate    # Generate Prisma Client
npm run prisma:migrate     # Run migrations
npm run prisma:seed        # Seed sample data

# Testing
npm run test               # Unit tests
npm run test:e2e           # E2E tests (14 test files)
npm run test:cov           # Coverage

# Build
npm run build              # Production build
npm run start:prod         # Start production server
```

#### Frontend (apps/web)

```bash
cd apps/web

# Development
npm run dev                # Start with Turbopack (Port 3001)

# Testing & Quality
npm run lint               # ESLint check
npm run build              # Production build (validates types)

# UI Components
npx shadcn@latest add [component]  # Add shadcn/ui component
```

### Demo Credentials

After seeding:

- Email: `demo@smartapply.com`
- Password: `Demo123!`

### Test Database Setup

The project uses a separate database for E2E tests to avoid affecting development data.

#### Automatic Setup (via setup.sh)

The `setup.sh` script automatically creates and migrates the test database:

```bash
chmod +x setup.sh
./setup.sh
```

#### Manual Setup

If you need to manually create or reset the test database:

```bash
# Create test database
docker exec smartapply-db psql -U postgres -c "CREATE DATABASE smartapply_test;"

# Apply migrations
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/smartapply_test" \
  npx prisma migrate deploy --schema=./apps/api/prisma/schema.prisma
```

#### Reset Test Database

To reset the test database (useful after schema changes):

```bash
# Drop and recreate
docker exec smartapply-db psql -U postgres -c "DROP DATABASE IF EXISTS smartapply_test;"
docker exec smartapply-db psql -U postgres -c "CREATE DATABASE smartapply_test;"

# Reapply migrations
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/smartapply_test" \
  npx prisma migrate deploy --schema=./apps/api/prisma/schema.prisma
```

#### Running Tests

```bash
cd apps/api

# Run all E2E tests
npm run test:e2e

# Run specific test suite
npm run test:e2e -- auth-refresh.e2e-spec.ts
npm run test:e2e -- xss-sanitization.e2e-spec.ts

# Run with coverage
npm run test:cov
```

**Note:** E2E tests automatically use the `smartapply_test` database configured in the test environment.

## 🎨 Frontend Features

### Implemented ✅

- **Landing Page**: Hero section, features showcase, call-to-action
- **Authentication**:
  - Login & Registration forms with validation
  - JWT token management (persisted in localStorage)
  - Protected routes with auto-redirect
- **Dashboard Layout**:
  - Responsive sidebar navigation
  - Mobile-friendly hamburger menu
  - User profile dropdown with logout
- **Dashboard**:
  - Statistics cards (Applications, Profile completion)
  - Recent applications list
  - Profile completion prompts
- **API Integration**:
  - Fully typed API client (`lib/api-client.ts`)
  - React Query for server state management
  - Custom hooks for Profile & Applications
- **UI Components**: 13 shadcn/ui components (Button, Input, Card, Form, Dialog, etc.)

### In Development ⏳

See [GitHub Issues #42-#55](https://github.com/Ar1anit/smart-apply/issues) for detailed roadmap:

- Profile Management (Edit forms for all sections)
- Job Postings (Parser & List View)
- Applications (Creation Wizard, List, Detail View)
- PDF Preview & Editing (react-pdf + Tiptap)
- Loading States & Error Handling

**Estimated Time:** 50-65 hours

## ☁️ Azure Deployment

### Azure Resources Required

Create these resources in your Azure subscription:

1. **Resource Group**: `rg-smartapply-prod`
2. **Azure Container Registry (ACR)**: `acrsmartapplyprod`
3. **Azure Container Apps (ACA)**: `aca-smartapply-api`
4. **Azure Database for PostgreSQL - Flexible Server**: `psql-smartapply-prod`
5. **Storage Account**: `stsmartapplyprod` (with container `smartapply`)
6. **Service Bus Namespace**: `sb-smartapply-prod` (with queue `application-jobs`)
7. **Key Vault**: `kv-smartapply-prod`
8. **Azure OpenAI**: Deployment with GPT-4 or GPT-4o

### Quick Provision Script (Azure CLI)

```bash
#!/bin/bash

RESOURCE_GROUP="rg-smartapply-prod"
LOCATION="eastus"
ACR_NAME="acrsmartapplyprod"
ACA_NAME="aca-smartapply-api"
ACA_ENV="aca-env-smartapply"
POSTGRES_SERVER="psql-smartapply-prod"
STORAGE_ACCOUNT="stsmartapplyprod"
SERVICE_BUS="sb-smartapply-prod"
KEY_VAULT="kv-smartapply-prod"

# Create Resource Group
az group create --name $RESOURCE_GROUP --location $LOCATION

# Create Container Registry
az acr create --resource-group $RESOURCE_GROUP --name $ACR_NAME --sku Basic --admin-enabled true

# Create PostgreSQL Flexible Server
az postgres flexible-server create \
  --resource-group $RESOURCE_GROUP \
  --name $POSTGRES_SERVER \
  --location $LOCATION \
  --admin-user smartapplyadmin \
  --admin-password 'ChangeMe123!' \
  --sku-name Standard_B1ms \
  --version 16 \
  --storage-size 32 \
  --public-access 0.0.0.0

# Create database
az postgres flexible-server db create \
  --resource-group $RESOURCE_GROUP \
  --server-name $POSTGRES_SERVER \
  --database-name smartapply

# Create Storage Account
az storage account create \
  --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --sku Standard_LRS

# Create blob container
az storage container create \
  --name smartapply \
  --account-name $STORAGE_ACCOUNT

# Create Service Bus
az servicebus namespace create \
  --resource-group $RESOURCE_GROUP \
  --name $SERVICE_BUS \
  --location $LOCATION \
  --sku Standard

az servicebus queue create \
  --resource-group $RESOURCE_GROUP \
  --namespace-name $SERVICE_BUS \
  --name application-jobs

# Create Key Vault
az keyvault create \
  --name $KEY_VAULT \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION

# Create Container Apps Environment
az containerapp env create \
  --name $ACA_ENV \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION

# Create Container App (placeholder - will be updated by CI/CD)
az containerapp create \
  --name $ACA_NAME \
  --resource-group $RESOURCE_GROUP \
  --environment $ACA_ENV \
  --image mcr.microsoft.com/azuredocs/containerapps-helloworld:latest \
  --target-port 3000 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 3

echo "✅ Azure resources provisioned successfully!"
```

### CI/CD with GitHub Actions (OIDC)

The project uses **OpenID Connect (OIDC)** for secure authentication to Azure without storing secrets.

#### 1. Create Azure AD App Registration

```bash
APP_NAME="github-smartapply-deploy"
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
RESOURCE_GROUP="rg-smartapply-prod"

# Create App Registration
APP_ID=$(az ad app create --display-name $APP_NAME --query appId -o tsv)

# Create Service Principal
az ad sp create --id $APP_ID

# Get Object ID
OBJECT_ID=$(az ad sp list --filter "appId eq '$APP_ID'" --query "[0].id" -o tsv)

# Assign Contributor role to resource group
az role assignment create \
  --role Contributor \
  --assignee $APP_ID \
  --scope /subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP

# Also assign AcrPush role for ACR
ACR_ID=$(az acr show --name acrsmartapplyprod --query id -o tsv)
az role assignment create \
  --role AcrPush \
  --assignee $APP_ID \
  --scope $ACR_ID
```

#### 2. Configure Federated Credentials

```bash
REPO_OWNER="your-github-username"
REPO_NAME="smart-apply"

# For main branch deployments
az ad app federated-credential create \
  --id $APP_ID \
  --parameters '{
    "name": "github-main-branch",
    "issuer": "https://token.actions.githubusercontent.com",
    "subject": "repo:'$REPO_OWNER'/'$REPO_NAME':ref:refs/heads/main",
    "audiences": ["api://AzureADTokenExchange"]
  }'

# For pull requests
az ad app federated-credential create \
  --id $APP_ID \
  --parameters '{
    "name": "github-pull-requests",
    "issuer": "https://token.actions.githubusercontent.com",
    "subject": "repo:'$REPO_OWNER'/'$REPO_NAME':pull_request",
    "audiences": ["api://AzureADTokenExchange"]
  }'
```

#### 3. Add GitHub Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions

Add these secrets (NO connection strings or API keys needed!):

- `AZURE_CLIENT_ID`: App ID from step 1
- `AZURE_TENANT_ID`: Your Azure AD tenant ID
- `AZURE_SUBSCRIPTION_ID`: Your subscription ID

```bash
# Get values
echo "AZURE_CLIENT_ID: $APP_ID"
echo "AZURE_TENANT_ID: $(az account show --query tenantId -o tsv)"
echo "AZURE_SUBSCRIPTION_ID: $SUBSCRIPTION_ID"
```

#### 4. Store Sensitive Config in Key Vault

```bash
KEY_VAULT="kv-smartapply-prod"

# Database connection string
DATABASE_URL="postgresql://smartapplyadmin:ChangeMe123!@psql-smartapply-prod.postgres.database.azure.com:5432/smartapply?sslmode=require"
az keyvault secret set --vault-name $KEY_VAULT --name "database-url" --value "$DATABASE_URL"

# JWT secret (CRITICAL: Must be 64+ characters for security)
az keyvault secret set --vault-name $KEY_VAULT --name "jwt-secret" --value "$(openssl rand -base64 64)"

# Storage connection string
STORAGE_CONN=$(az storage account show-connection-string --name stsmartapplyprod --query connectionString -o tsv)
az keyvault secret set --vault-name $KEY_VAULT --name "storage-connection-string" --value "$STORAGE_CONN"

# Service Bus connection string
SB_CONN=$(az servicebus namespace authorization-rule keys list --resource-group $RESOURCE_GROUP --namespace-name sb-smartapply-prod --name RootManageSharedAccessKey --query primaryConnectionString -o tsv)
az keyvault secret set --vault-name $KEY_VAULT --name "service-bus-connection-string" --value "$SB_CONN"

# Azure OpenAI (replace with your values)
az keyvault secret set --vault-name $KEY_VAULT --name "openai-endpoint" --value "https://your-instance.openai.azure.com/"
az keyvault secret set --vault-name $KEY_VAULT --name "openai-api-key" --value "your-api-key"
```

#### 5. Configure Container App to Use Key Vault

```bash
# Enable managed identity
az containerapp identity assign \
  --name $ACA_NAME \
  --resource-group $RESOURCE_GROUP \
  --system-assigned

# Get identity principal ID
IDENTITY_ID=$(az containerapp show --name $ACA_NAME --resource-group $RESOURCE_GROUP --query identity.principalId -o tsv)

# Grant Key Vault access
az keyvault set-policy \
  --name $KEY_VAULT \
  --object-id $IDENTITY_ID \
  --secret-permissions get list

# Update Container App with Key Vault references
az containerapp update \
  --name $ACA_NAME \
  --resource-group $RESOURCE_GROUP \
  --set-env-vars \
    "DATABASE_URL=secretref:database-url" \
    "JWT_SECRET=secretref:jwt-secret" \
    "AZURE_STORAGE_CONNECTION_STRING=secretref:storage-connection-string" \
    "SERVICE_BUS_CONNECTION_STRING=secretref:service-bus-connection-string" \
    "AZURE_OPENAI_ENDPOINT=secretref:openai-endpoint" \
    "AZURE_OPENAI_API_KEY=secretref:openai-api-key" \
    "NODE_ENV=production" \
    "STORAGE_DRIVER=azure" \
    "LLM_PROVIDER=azure-openai" \
  --secrets \
    "database-url=keyvaultref:https://$KEY_VAULT.vault.azure.net/secrets/database-url,identityref:system" \
    "jwt-secret=keyvaultref:https://$KEY_VAULT.vault.azure.net/secrets/jwt-secret,identityref:system" \
    "storage-connection-string=keyvaultref:https://$KEY_VAULT.vault.azure.net/secrets/storage-connection-string,identityref:system" \
    "service-bus-connection-string=keyvaultref:https://$KEY_VAULT.vault.azure.net/secrets/service-bus-connection-string,identityref:system" \
    "openai-endpoint=keyvaultref:https://$KEY_VAULT.vault.azure.net/secrets/openai-endpoint,identityref:system" \
    "openai-api-key=keyvaultref:https://$KEY_VAULT.vault.azure.net/secrets/openai-api-key,identityref:system"
```

#### 6. Deploy

Push to `main` branch or manually trigger the workflow. The pipeline will:

1. Authenticate to Azure using OIDC (no secrets!)
2. Build Docker image
3. Push to ACR
4. Run database migrations
5. Deploy new revision to Container Apps
6. Pull secrets from Key Vault automatically

## 🧪 Testing

### E2E Tests

```bash
npm run test:e2e
```

Tests cover:

- Authentication flow (register, login, JWT validation)
- Profile CRUD operations
- Application pipeline (with mock LLM provider)

## 📚 API Documentation

Access Swagger documentation at `/docs` when running locally.

### Key Endpoints

#### Auth

- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login
- `GET /api/v1/auth/me` - Get current user

#### Profile

- `GET /api/v1/profile` - Get user profile
- `PUT /api/v1/profile` - Update profile (Skills, Experiences, Education, Certificates, Projects)

#### Job Postings

- `POST /api/v1/job-postings:parse` - Parse job description (text, URL, or file)
- `GET /api/v1/job-postings` - List job postings
- `GET /api/v1/job-postings/:id` - Get job posting details
- `DELETE /api/v1/job-postings/:id` - Delete job posting

#### Applications

- `POST /api/v1/applications` - Create new application
- `GET /api/v1/applications` - List all applications
- `GET /api/v1/applications/:id` - Get application details
- `GET /api/v1/applications/:id/status` - Get lightweight status (for polling)
- `GET /api/v1/applications/:id/stream` - Stream real-time status updates (SSE)
- `GET /api/v1/applications/:id/files` - Get PDF download URLs (SAS)

### Additional Documentation

- **[Agent-Based URL Parser Guide](./docs/AGENT_URL_PARSER.md)** - Complete guide for parsing JavaScript-heavy job sites
- **[Architecture Documentation](./ARCHITECTURE.md)** - Detailed system architecture
- **[Agent Instructions](./my-agents.md)** - Development guidelines and best practices
- **[SSE Implementation Guide](./docs/SSE_IMPLEMENTATION.md)** - Server-Sent Events for real-time status updates

## 🔒 Security

- **Helmet**: Security headers (XSS, clickjacking, MIME sniffing protection)
- **CORS**: Restrictive whitelist with environment-based origins
- **Rate Limiting**: Dual-tier throttling via @nestjs/throttler
  - Auth endpoints: 5 attempts / 15 minutes (strict)
  - Standard endpoints: 100 requests / 15 minutes
- **Password Hashing**: argon2 (memory-hard, ASIC-resistant)
- **Password Validation**: 8+ chars, mixed case, number, special character
- **JWT**: Secure token-based authentication (64+ character secrets enforced)
- **CSRF Protection**: Optional (disabled by default for MVP, set `ENABLE_CSRF=true` to enable)
- **Secrets Management**: Azure Key Vault in production
- **SAS Tokens**: Time-limited blob access
- **Input Validation**: class-validator with strict DTOs

### Security Documentation

For detailed security procedures including JWT secret rotation, incident response, and production deployment checklist, see **[docs/SECURITY.md](./docs/SECURITY.md)**.

**Current Security Score: 7.5/10** - See [MVP_FEATURES.md](./MVP_FEATURES.md) for remaining security todos before production deployment.

## 📦 Database Schema

See `apps/api/prisma/schema.prisma` for complete schema.

**Models**: User, Profile, Skill, Certificate, Experience, Project, JobPosting, Application

## 🤖 LLM Integration

Smart Apply supports multiple LLM providers through a pluggable interface:

### Available Providers

#### 1. **Mock Provider** (Default)

For testing without API calls. Returns placeholder content.

```bash
LLM_PROVIDER=mock
```

#### 2. **Azure OpenAI Provider**

Production-grade provider using Azure OpenAI Service.

```bash
LLM_PROVIDER=azure-openai
AZURE_OPENAI_ENDPOINT=https://your-instance.openai.azure.com/
AZURE_OPENAI_API_KEY=your_api_key
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o
AZURE_OPENAI_API_VERSION=2024-02-15-preview
```

#### 3. **Azure AI Foundry Agents** 🆕 (Recommended for Production)

Leverage specialized AI agents deployed in Azure AI Foundry for resume and cover letter generation. Uses dedicated **CV Writer** and **CL Writer** agents with automatic fallback to Azure OpenAI.

```bash
LLM_PROVIDER=azure-ai-foundry

# Azure AI Foundry Agent endpoints
AZURE_AI_FOUNDRY_CV_WRITER_ENDPOINT=https://your-cv-writer-agent.inference.ml.azure.com/score
AZURE_AI_FOUNDRY_CL_WRITER_ENDPOINT=https://your-cl-writer-agent.inference.ml.azure.com/score
AZURE_AI_FOUNDRY_API_KEY=your_ai_foundry_api_key

# Azure OpenAI fallback (required)
AZURE_OPENAI_ENDPOINT=https://your-instance.openai.azure.com/
AZURE_OPENAI_API_KEY=your_openai_api_key
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o
AZURE_OPENAI_API_VERSION=2024-02-15-preview
```

**Features:**

- **Specialized Agents**: Dedicated CV Writer and CL Writer agents optimized for document generation
- **Intelligent Routing**: Automatically routes resume requests to CV Writer and cover letter requests to CL Writer
- **Automatic Fallback**: Falls back to Azure OpenAI if agent endpoints are unavailable
- **Production Ready**: 60-second timeout, multiple response format support, comprehensive error handling
- **Observability**: Detailed logging for debugging and monitoring

**How It Works:**

1. Application detects document type from prompt keywords (resume/CV or cover letter)
2. Routes request to appropriate Azure AI Foundry agent (CV Writer or CL Writer)
3. If agent fails or is unavailable, automatically falls back to Azure OpenAI
4. Supports multiple response formats for maximum compatibility

**Setup:**

1. Deploy CV Writer and CL Writer agents in Azure AI Foundry
2. Obtain agent endpoints and API key from Azure portal
3. Add configuration to `.env`:

   ```bash
   LLM_PROVIDER=azure-ai-foundry
   AZURE_AI_FOUNDRY_CV_WRITER_ENDPOINT=https://...
   AZURE_AI_FOUNDRY_CL_WRITER_ENDPOINT=https://...
   AZURE_AI_FOUNDRY_API_KEY=your_key

   # Fallback configuration (recommended)
   AZURE_OPENAI_ENDPOINT=https://...
   AZURE_OPENAI_API_KEY=your_key
   AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o
   ```

4. Restart the server

**Notes:**

- Both agent endpoints must be provided for full functionality
- Azure OpenAI fallback configuration is highly recommended for reliability
- Agent responses are cached for performance
- Prompt detection uses keyword matching (resume/CV vs cover letter)

#### 4. **Hugging Face Provider**

For local development with open-source models via Hugging Face Inference API.

```bash
LLM_PROVIDER=huggingface
HUGGINGFACE_API_KEY=hf_your_api_key_here
HUGGINGFACE_MODEL=meta-llama/Llama-2-7b-chat-hf
```

**Supported Models:**

- `meta-llama/Llama-2-7b-chat-hf` (Default, recommended)
- `meta-llama/Llama-2-13b-chat-hf` (Better quality, slower)
- `mistralai/Mistral-7B-Instruct-v0.1` (Fast, good quality)
- `tiiuae/falcon-7b-instruct` (Alternative option)

**Setup:**

1. Get a free API key from [Hugging Face](https://huggingface.co/settings/tokens)
2. Add to `.env`:

   ```bash
   LLM_PROVIDER=huggingface
   HUGGINGFACE_API_KEY=hf_xxxxxxxxxxxxx
   HUGGINGFACE_MODEL=meta-llama/Llama-2-7b-chat-hf
   ```

3. Restart the server

**Notes:**

- Free tier has rate limits (check [Hugging Face pricing](https://huggingface.co/pricing))
- First request may be slow (model cold start)
- Supports custom temperature and max_tokens options
- Automatic prompt formatting for different model types

### Prompt Templates

All providers use Markdown-based templates in `/prompts`:

- `cover-letter.md` - Cover letter generation template
- `resume.md` - Resume generation template

## 🔄 Background Jobs

Uses **Azure Service Bus** for:

- Application generation pipeline
- Async PDF creation
- Job posting parsing (if from URL)

## 📝 License

MIT

## 👥 Contributing

Contributions welcome! Please open an issue or PR.

---

## 🎨 SmartApply Design

[Figma-Projekt: SmartApply](https://www.figma.com/files/team/1506699563431594213/project/478813064/SmartApply?fuid=1506699559070757185)

---

Built with ❤️ using NestJS and Azure
