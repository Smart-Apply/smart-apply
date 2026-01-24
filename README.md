# Smart Apply

AI-Powered Job Application Assistant - Generate tailored cover letters and resumes.

**Status:** 96% Complete - Ready for Beta Testing

## ✨ Features

- **Profile Management** - Skills, Experience, Education, Certificates, Projects, Languages
- **Smart Job Parsing** - URL parsing with AI agent (Indeed, LinkedIn, Glassdoor)
- **AI Content Generation** - Azure OpenAI powered cover letters & resumes
- **Multi-Language Support** - Automatic language detection (DE/EN)
- **ATS-Optimized PDFs** - 50 professional templates (5 designs × 5 languages × 2 types)
- **Real-time Updates** - SSE for live status tracking
- **Secure Auth** - JWT + Refresh Tokens + Session Management

## 🛠️ Tech Stack

| Layer              | Technology                                      |
| ------------------ | ----------------------------------------------- |
| **Frontend**       | Next.js 16, React 19, Tailwind v4, shadcn/ui    |
| **Backend**        | NestJS 11, Prisma 5, PostgreSQL 16              |
| **AI**             | Azure AI Foundry, Azure OpenAI (GPT-4o)         |
| **PDF**            | Puppeteer 24, Handlebars Templates              |
| **Infrastructure** | Docker, Azure Container Apps                    |

## 🚀 Quick Start

### Prerequisites

- Node.js 24+ (or 20.19+)
- Docker Desktop
- npm

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Start database
docker compose -f infra/docker-compose.yml up -d db

# 3. Setup environment & database
cp .env.example .env
npm run prisma:migrate
npm run prisma:seed

# 4. Start development
npm run dev
```

### Access

| Service          | URL                           |
| ---------------- | ----------------------------- |
| **Frontend**     | <http://localhost:3001>       |
| **API**          | <http://localhost:3000>       |
| **Swagger Docs** | <http://localhost:3000/docs>  |

### Demo Login

- **Email:** `demo@smartapply.com`
- **Password:** `Demo123!`

## 📁 Project Structure

```text
smart-apply/
├── apps/
│   ├── api/          # NestJS Backend (Port 3000)
│   │   ├── src/      # Source code
│   │   ├── prisma/   # Database schema
│   │   └── test/     # E2E & Unit tests
│   └── web/          # Next.js Frontend (Port 3001)
│       └── src/      # Source code
├── docs/             # Documentation
├── infra/            # Docker configs
└── packages/shared/  # Shared types
```

## 🔧 Commands

```bash
# Development
npm run dev           # Start API + Frontend
npm run api:dev       # Start API only
npm run web:dev       # Start Frontend only

# Database
npm run prisma:studio # Open Prisma Studio
npm run prisma:seed   # Seed demo data

# Testing
npm run test:e2e      # Run E2E tests
npm run test:unit     # Run unit tests
```

## 🔒 Security

- JWT Authentication with HttpOnly Cookies
- Refresh Token Rotation
- Rate Limiting (5/15min auth, 100/15min standard)
- XSS Protection (@Sanitize decorator)
- CORS Whitelist
- Audit Logging

## 📖 Documentation

| Document                             | Description          |
| ------------------------------------ | -------------------- |
| [ARCHITECTURE.md](ARCHITECTURE.md)   | System architecture  |
| [QUICKSTART.md](QUICKSTART.md)       | Detailed setup guide |
| [docs/](docs/)                       | Full documentation   |

## 🌐 Deployment

See [docs/guides/AZURE_DEPLOYMENT.md](docs/guides/AZURE_DEPLOYMENT.md) for Azure deployment instructions.

## 📄 License

MIT
