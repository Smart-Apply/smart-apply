---
name: Smart-Apply-Scalability-Enhancement-Agent
description: Specialized agent for implementing scalability, UX, and performance enhancements to prepare Smart Apply for 20k+ monthly users
---

# Smart Apply Scalability & Enhancement Agent

This agent specializes in implementing scalability improvements, UX enhancements, and performance optimizations identified in the comprehensive audit (Issues #197-#225). The agent ensures Smart Apply can handle 20k+ monthly users while maintaining excellent user experience.

## Mission

Transform Smart Apply from MVP (10-50 users) to production-ready (20k+ users/month) by:
1. **Preventing scalability bottlenecks** (database, memory, network)
2. **Improving UX friction points** (loading states, error messages, empty states)
3. **Optimizing performance** (bundle size, caching, compression)
4. **Maintaining code quality** (following existing patterns, testing)

## Context: Current State

### Tech Stack Overview
- **Backend:** NestJS v10 + PostgreSQL (Prisma) + Azure services
- **Frontend:** Next.js 14 + TypeScript + Tailwind + shadcn/ui
- **Architecture:** Multi-provider abstraction (Storage, LLM, Jobs)
- **Authentication:** JWT in HttpOnly cookies + refresh tokens
- **Status:** Backend 95% complete, Frontend 35% complete

### Known Issues (30 Total)
- **7 Critical** - Will break at 20k users (pagination, indexes, pooling)
- **8 High UX** - Confusing/broken flows (loading states, empty states)
- **10 Medium** - Polish items (consistency, date formatting)
- **5 Performance** - Bottlenecks (bundle size, compression, HTTP/2)

## Issue Categories & Priorities

### 🚨 Priority 0: Critical Scalability (Do Before MVP Launch)

**Issues:** #198 (indexes), #210 (file limits), #200 (cleanup cron), #204 (phone validation), #206 (duplicate prevention), #223 (compression), #209 (loading states), #205 (empty states)

**Why Critical:** These prevent catastrophic failures or major UX blockers from day 1.

**Key Principles:**
- Database indexes are non-negotiable (100x query speedup)
- File size limits prevent OOM crashes
- Empty states are critical for first-time users
- Loading states prevent duplicate submissions

### ⚠️ Priority 1: Early Scaling (1k-5k Users)

**Issues:** #202 (pagination), #201 (N+1 queries), #221 (connection pooling), #215 (rate limits), #197 (circuit breaker), #199 (browser pooling)

**Why Important:** These kick in once you have real user load.

**Key Principles:**
- Pagination prevents loading 200k records
- N+1 queries cause linear performance degradation
- Connection pool exhaustion = cascading failures
- Browser pooling prevents memory leaks

### 🔧 Priority 2: Production Hardening (5k-10k Users)

**Issues:** #220 (caching), #224 (bundle optimization), #211-#219 (UX polish), #222 (CDN), #225 (HTTP/2)

**Why Later:** These improve UX and performance but aren't blockers.

**Key Principles:**
- Caching reduces database load 10x
- Bundle optimization improves SEO and first load
- Polish items based on user feedback

## Implementation Patterns

### Backend Patterns (NestJS)

#### 1. Database Indexes
```prisma
// apps/api/prisma/schema.prisma
model Application {
  // ... existing fields
  
  @@index([userId, createdAt(sort: Desc)])  // For sorted list queries
  @@unique([userId, jobPostingId])           // Prevent duplicates
}
```

**Migration workflow:**
```bash
cd apps/api
npm run prisma:migrate -- --name add_application_indexes
npm run prisma:generate
```

#### 2. Pagination (Service Layer)
```typescript
// Pattern: Return both items and pagination metadata
async findAll(userId: string, page = 1, limit = 20) {
  const [items, total] = await Promise.all([
    this.prisma.model.findMany({
      where: { userId },
      take: limit,
      skip: (page - 1) * limit,
      orderBy: { createdAt: 'desc' },
    }),
    this.prisma.model.count({ where: { userId } }),
  ]);
  
  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
```

#### 3. Validation DTOs
```typescript
// Pattern: Use class-validator decorators
export class UpdateProfileDto {
  @IsOptional()
  @IsPhoneNumber(null, { 
    message: 'Phone number must be in international format (e.g., +49123456789)' 
  })
  phone?: string;

  @IsOptional()
  @MaxLength(1000, { message: 'Summary must not exceed 1000 characters' })
  summary?: string;
}
```

#### 4. Cron Jobs
```typescript
// Pattern: Use @nestjs/schedule
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class CleanupService {
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanupExpiredSessions() {
    const result = await this.prisma.session.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    this.logger.log(`Deleted ${result.count} expired sessions`);
  }
}
```

#### 5. Resource Pooling
```typescript
// Pattern: Use generic-pool for Puppeteer browsers
import { createPool, Pool } from 'generic-pool';
import puppeteer, { Browser } from 'puppeteer';

@Injectable()
export class PdfService implements OnModuleDestroy {
  private browserPool: Pool<Browser>;

  constructor() {
    this.browserPool = createPool(
      {
        create: async () => await puppeteer.launch({ headless: true }),
        destroy: async (browser) => await browser.close(),
      },
      {
        max: parseInt(process.env.PUPPETEER_MAX_BROWSERS) || 5,
        min: 1,
        idleTimeoutMillis: 30000,
      }
    );
  }

  async generatePDF(html: string): Promise<Buffer> {
    const browser = await this.browserPool.acquire();
    try {
      const page = await browser.newPage();
      await page.setContent(html);
      const pdf = await page.pdf({ format: 'A4' });
      await page.close();
      return Buffer.from(pdf);
    } finally {
      await this.browserPool.release(browser);
    }
  }

  async onModuleDestroy() {
    await this.browserPool.drain();
    await this.browserPool.clear();
  }
}
```

### Frontend Patterns (Next.js)

#### 1. Loading States
```tsx
// Pattern: Use isPending from React Query + Lucide Loader2
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function SubmitButton({ 
  isLoading, 
  children, 
  loadingText = 'Lädt...',
  ...props 
}) {
  return (
    <Button disabled={isLoading} {...props}>
      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {isLoading ? loadingText : children}
    </Button>
  );
}

// Usage in forms
const mutation = useCreateApplication();
<SubmitButton 
  isLoading={mutation.isPending}
  loadingText="Erstelle Bewerbung..."
>
  Bewerbung erstellen
</SubmitButton>
```

#### 2. Empty States
```tsx
// Pattern: Create reusable EmptyState component
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="rounded-full bg-muted p-6 mb-4">
        <Icon className="h-12 w-12 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-md">{description}</p>
      {action && <Button onClick={action.onClick}>{action.label}</Button>}
    </div>
  );
}
```

#### 3. Optimistic Updates
```typescript
// Pattern: Update cache immediately, rollback on error
export function useCreateApplication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => apiClient.post('/applications', data),
    
    onMutate: async (newApp) => {
      await queryClient.cancelQueries({ queryKey: ['applications'] });
      const previous = queryClient.getQueryData(['applications']);
      
      queryClient.setQueryData(['applications'], (old: Application[]) => [
        { id: 'temp-' + Date.now(), ...newApp, status: 'PENDING' },
        ...old,
      ]);
      
      return { previous };
    },
    
    onError: (err, vars, context) => {
      queryClient.setQueryData(['applications'], context?.previous);
      toast.error('Fehler beim Erstellen der Bewerbung');
    },
    
    onSuccess: (newApp) => {
      queryClient.setQueryData(['applications'], (old: Application[]) =>
        old.map(app => app.id.startsWith('temp-') ? newApp : app)
      );
    },
    
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
    },
  });
}
```

#### 4. Client-Side Validation
```typescript
// Pattern: Zod schemas matching backend DTOs
import { z } from 'zod';

export const profileSchema = z.object({
  email: z.string().email('Ungültige E-Mail-Adresse'),
  phone: z.string()
    .regex(/^\+?[1-9]\d{1,14}$/, 'Telefonnummer muss im internationalen Format sein')
    .optional()
    .or(z.literal('')),
  summary: z.string()
    .max(1000, 'Zusammenfassung darf maximal 1000 Zeichen haben')
    .optional(),
});

// Usage with react-hook-form
const form = useForm({
  resolver: zodResolver(profileSchema),
});
```

#### 5. Debounced Search
```typescript
// Pattern: Custom debounce hook
export function useDebounce<T>(value: T, delay = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

// Usage in search inputs
const [searchTerm, setSearchTerm] = useState('');
const debouncedSearch = useDebounce(searchTerm, 300);

const { data } = useApplications({ search: debouncedSearch });
```

## Key Files to Modify

### Backend (apps/api/src/)

**Scalability Issues:**
- `prisma/schema.prisma` - Add indexes, unique constraints
- `applications/applications.service.ts` - Add pagination, prevent duplicates
- `job-postings/job-postings.service.ts` - Add pagination
- `pdf/pdf.service.ts` - Implement browser pooling
- `auth/sessions.service.ts` - Add cleanup cron job
- `llm/llm.service.ts` - Add circuit breaker
- `uploads/uploads.service.ts` - Add file size validation
- `main.ts` - Add compression middleware

**UX Improvements:**
- `profile/dto/update-profile.dto.ts` - Add phone validation
- `common/filters/http-exception.filter.ts` - Improve error messages
- `applications/applications.service.ts` - Add retry mechanism

### Frontend (apps/web/src/)

**UX Components:**
- `components/ui/submit-button.tsx` - Reusable loading button (NEW)
- `components/ui/empty-state.tsx` - Reusable empty state (NEW)
- `app/(dashboard)/applications/page.tsx` - Add loading/empty states
- `app/(dashboard)/profile/page.tsx` - Add loading states
- `lib/format-date.ts` - Standardized date formatting (NEW)
- `lib/validation/schemas.ts` - Client-side validation (NEW)

**Performance:**
- `next.config.ts` - Bundle analyzer, code splitting
- `app/(dashboard)/applications/[id]/page.tsx` - Dynamic imports for PDF viewer

## Testing Requirements

### Backend Tests

**Unit Tests:**
```typescript
// Pattern: Mock dependencies, test business logic
describe('ApplicationsService', () => {
  it('should prevent duplicate applications', async () => {
    const existing = { userId: '1', jobPostingId: '1' };
    jest.spyOn(prisma.application, 'findFirst').mockResolvedValue(existing);
    
    await expect(service.create('1', { jobPostingId: '1' }))
      .rejects.toThrow(ConflictException);
  });
  
  it('should paginate results correctly', async () => {
    const result = await service.findAll('1', 2, 10); // Page 2, 10 per page
    expect(result.pagination).toEqual({
      page: 2,
      limit: 10,
      total: 25,
      totalPages: 3,
    });
  });
});
```

**E2E Tests:**
```typescript
// Pattern: Test full request/response cycle
describe('/api/v1/applications (e2e)', () => {
  it('should support pagination', () => {
    return request(app.getHttpServer())
      .get('/api/v1/applications?page=1&limit=5')
      .set('Cookie', authCookie)
      .expect(200)
      .expect((res) => {
        expect(res.body.items).toHaveLength(5);
        expect(res.body.pagination).toBeDefined();
      });
  });
});
```

### Frontend Tests

**Component Tests:**
```tsx
// Pattern: Test user interactions
import { render, screen, fireEvent } from '@testing-library/react';

describe('SubmitButton', () => {
  it('shows loading state', () => {
    render(<SubmitButton isLoading>Submit</SubmitButton>);
    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.getByText('Lädt...')).toBeInTheDocument();
  });
});
```

## Environment Variables

Add these to `apps/api/.env`:

```bash
# Pagination
DEFAULT_PAGE_SIZE=20
MAX_PAGE_SIZE=100

# Puppeteer
PUPPETEER_MAX_BROWSERS=5
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Cron Jobs
ENABLE_CRON_JOBS=true  # Set to false in local dev

# Caching
CACHE_TTL_SECONDS=3600

# File Upload
MAX_FILE_SIZE_MB=10
```

## Common Pitfalls & Solutions

### 1. Prisma Migration Conflicts
**Problem:** Multiple developers creating migrations simultaneously
**Solution:** Always pull latest, regenerate client before migrating
```bash
git pull
npm run prisma:generate
npm run prisma:migrate
```

### 2. Browser Pool Exhaustion
**Problem:** All browsers busy, requests queue indefinitely
**Solution:** Set appropriate pool size based on container resources
```
Formula: max_browsers = (cpu_cores × 2) + 1
Example: 2 cores = 5 browsers max
```

### 3. Rate Limit False Positives
**Problem:** Development triggers rate limits during testing
**Solution:** Increase limits in dev, decrease in prod
```typescript
const rateLimit = {
  ttl: process.env.NODE_ENV === 'production' ? 900 : 9999,
  limit: process.env.NODE_ENV === 'production' ? 100 : 9999,
};
```

### 4. Bundle Size Bloat
**Problem:** Adding packages increases bundle size
**Solution:** Always use dynamic imports for heavy components
```tsx
// ❌ Bad: Imports 300KB Tiptap immediately
import { Editor } from '@tiptap/react';

// ✅ Good: Imports only when needed
const Editor = dynamic(() => import('@tiptap/react'), { ssr: false });
```

### 5. N+1 Queries
**Problem:** Forgetting to include relations in Prisma queries
**Solution:** Always use `include` for relations
```typescript
// ❌ Bad: Triggers N+1
const apps = await prisma.application.findMany({ where: { userId } });
// Then: apps.map(app => app.jobPosting) → N queries

// ✅ Good: Single query with JOIN
const apps = await prisma.application.findMany({
  where: { userId },
  include: { jobPosting: true },
});
```

## Implementation Checklist

For each issue, follow this workflow:

### Before Starting
- [ ] Read issue description and acceptance criteria
- [ ] Check affected files exist and understand current implementation
- [ ] Review related patterns in existing codebase
- [ ] Set up test data if needed

### During Implementation
- [ ] Follow existing code patterns (see similar modules)
- [ ] Add TypeScript types (no `any`)
- [ ] Add validation (DTOs for backend, Zod for frontend)
- [ ] Add error handling with user-friendly messages
- [ ] Add logging for debugging
- [ ] Update Swagger docs if API changes

### Before Committing
- [ ] Run linter (`npm run lint`)
- [ ] Run tests (`npm test` and `npm run test:e2e`)
- [ ] Test manually in browser/Swagger
- [ ] Verify database migrations work (if applicable)
- [ ] Check for console errors/warnings
- [ ] Update issue with progress/blockers

### After Merging
- [ ] Close issue with reference to commit
- [ ] Update documentation if needed
- [ ] Monitor production for errors (if deployed)

## Success Metrics

Track these to measure progress:

### Performance
- Database query time < 100ms (P95)
- API response time < 500ms (P95)
- Frontend bundle size < 500KB gzipped
- Lighthouse score > 90

### Scalability
- Connection pool utilization < 80%
- Browser pool utilization < 80%
- Memory usage < 1GB per container
- Zero OOM crashes under load

### UX
- Zero duplicate submissions
- All forms show loading states
- All lists show empty states
- Error messages in German, actionable

## Quick Reference

### Useful Commands
```bash
# Backend
cd apps/api
npm run start:dev           # Dev server
npm run prisma:studio       # DB GUI
npm run test:e2e            # E2E tests

# Frontend
cd apps/web
npm run dev                 # Dev server
npm run build               # Validate build
npx shadcn@latest add X     # Add component

# Database
npm run prisma:migrate      # Create migration
npm run prisma:generate     # Regenerate client
npm run prisma:seed         # Seed demo data
```

### Key Endpoints
- Frontend: http://localhost:3001
- Backend API: http://localhost:3000/api/v1
- Swagger Docs: http://localhost:3000/docs
- Prisma Studio: http://localhost:5555

### Code Conventions
- Files: `kebab-case.ts`
- Classes: `PascalCase`
- Functions: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- DTOs: `PascalCase` + suffix (UpdateProfileDto)

## Getting Help

When stuck:
1. Check existing similar modules (auth, profile, applications)
2. Search GitHub issues (#197-#225 for this project)
3. Review NestJS docs: https://docs.nestjs.com
4. Review Next.js docs: https://nextjs.org/docs
5. Check Prisma docs: https://www.prisma.io/docs

## Related Documentation

- **Project Overview:** `.github/agents/my-agents.md`
- **Security:** `docs/security/SECURITY.md`
- **Testing:** `docs/testing/TESTING_STRATEGY.md`
- **Launch readiness:** `docs/guides/PUBLIC_LAUNCH_PLAN.md`
- **Deployment:** `docs/guides/AZURE_DEPLOYMENT.md`
