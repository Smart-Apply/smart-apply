# Quick Start Guide - Smart Apply

## 🚀 Get Started in 5 Minutes

### Prerequisites
- Node.js 20+
- Docker Desktop
- npm

### Steps

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Start database**
   ```bash
   docker compose -f infra/docker-compose.yml up -d db
   ```

3. **Setup database**
   ```bash
   cp .env.example .env
   npm run prisma:migrate
   npm run prisma:seed
   ```

4. **Start the API**
   ```bash
   npm run start:dev
   ```

5. **Test it out**
   - Open: http://localhost:3000/docs
   - Try the auth endpoints with demo user:
     - Email: `demo@smartapply.com`
     - Password: `Demo123!`

## 📝 What's Implemented

✅ **Core Infrastructure**
- NestJS application with TypeScript
- PostgreSQL database with Prisma ORM
- Docker containerization (dev + prod)
- Environment configuration with Zod validation
- Global error handling and validation

✅ **Authentication**
- JWT-based auth (register, login, me)
- Password hashing with argon2
- Auth guards and decorators

✅ **Storage**
- Provider interface with disk + Azure Blob implementations
- SAS URL generation for secure downloads

✅ **LLM Integration**
- Provider interface
- Azure OpenAI adapter
- Mock provider for testing
- Prompt template system

✅ **Security**
- Helmet (security headers)
- CORS configuration
- Rate limiting
- Input validation

✅ **DevOps**
- Multi-stage Dockerfile
- Docker Compose for local dev
- GitHub Actions with Azure OIDC
- Comprehensive README

✅ **Documentation**
- Swagger/OpenAPI
- Detailed README with Azure deployment guide
- E2E test examples

## 🔨 TODO - Remaining Modules

The following modules are **not yet implemented** but have been architectured:

### Profile Module
- GET/PUT `/api/v1/profile`
- CRUD for skills, certificates, experiences, projects
- Profile aggregation for LLM context

### Uploads Module
- POST `/api/v1/uploads`
- File validation
- Storage integration

### Job Postings Module
- POST `/api/v1/job-postings:parse`
- Text/URL/file parsing
- Normalization (title, company, requirements, responsibilities)

### PDF Module
- Puppeteer-based HTML → PDF
- Template rendering
- Chromium integration

### Jobs Module (Service Bus)
- Azure Service Bus producer/consumer
- Background job processing
- Application pipeline orchestration

### Applications Module
- POST `/api/v1/applications`
- GET `/api/v1/applications/:id`
- GET `/api/v1/applications/:id/files`
- Pipeline: PENDING → GENERATING → READY/FAILED
- LLM integration for cover letter + resume
- PDF generation and storage

### Health Check
- `/health` endpoint with Nest Terminus
- Database connectivity check
- Storage availability check

## 🎯 Next Steps

To complete the MVP, implement the remaining modules in this order:

1. **Profile Module** - Core data source for generation
2. **PDF Module** - Required for output
3. **Jobs Module** - Background processing
4. **Job Postings Module** - Input parsing
5. **Applications Module** - Main pipeline
6. **Uploads Module** - File handling
7. **Health Check** - Monitoring

Each module should follow the established patterns:
- DTOs with validation
- Service layer
- Controller with Swagger docs
- Integration with existing providers
- E2E tests

## 📚 Key Files to Review

- `apps/api/src/app.module.ts` - Main application module
- `apps/api/src/config/env.schema.ts` - Environment variables
- `apps/api/prisma/schema.prisma` - Database schema
- `infra/Dockerfile` - Container build
- `.github/workflows/azure-deploy.yml` - CI/CD pipeline

## 🧪 Testing

```bash
# E2E tests (Auth module)
npm run test:e2e

# Unit tests
npm run test

# Coverage
npm run test:cov
```

## 🐛 Common Issues

**Database connection fails**
- Ensure Docker is running
- Check DATABASE_URL in .env
- Verify PostgreSQL container is healthy: `docker ps`

**Dependencies not installing**
- Delete `node_modules` and `package-lock.json`
- Run `npm install` again

**Prisma errors**
- Generate client: `npm run prisma:generate`
- Reset database: `npm run prisma:migrate reset`

## 🎉 Success Criteria

You'll know it's working when:
- ✅ Swagger UI loads at `/docs`
- ✅ Can register/login a user
- ✅ Database has seeded demo data
- ✅ Mock LLM provider generates sample content
- ✅ E2E tests pass

Happy coding! 🚀
