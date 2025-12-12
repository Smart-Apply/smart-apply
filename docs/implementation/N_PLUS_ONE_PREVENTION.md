# N+1 Query Prevention in Smart Apply

## Problem Statement

**N+1 queries** occur when you fetch a list of N items, then execute an additional query for each item to fetch related data, resulting in **1 + N total queries** instead of a single efficient query.

### Example of N+1 Problem (BAD)
```typescript
// Fetch 100 applications
const applications = await prisma.application.findMany({ where: { userId } });

// For EACH application, fetch the job posting (100 additional queries!)
for (const app of applications) {
  const jobPosting = await prisma.jobPosting.findUnique({ 
    where: { id: app.jobPostingId } 
  });
}
// Total: 1 + 100 = 101 queries ❌
```

### Solution: Eager Loading (GOOD)
```typescript
// Fetch applications WITH job postings in a single JOIN query
const applications = await prisma.application.findMany({
  where: { userId },
  include: {
    jobPosting: true, // Prisma uses JOIN or IN clause
  },
});
// Total: 1-2 queries (depending on Prisma's strategy) ✅
```

## Implementation in Smart Apply

### Applications Service

The `ApplicationsService.findAll()` and `findOne()` methods use Prisma's `include` option to prevent N+1 queries:

```typescript
async findAll(userId: string, includeJobPosting = false, page = 1, limit = 20) {
  const [applications, total] = await Promise.all([
    this.prisma.application.findMany({
      where: { userId },
      include: {
        jobPosting: includeJobPosting, // Conditional eager loading
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: (page - 1) * limit,
    }),
    this.prisma.application.count({ where: { userId } }),
  ]);

  return { items, pagination };
}
```

**Key Points:**
- ✅ Uses `include: { jobPosting: includeJobPosting }` for eager loading
- ✅ Only loads job posting when requested (`?includeJobPosting=true`)
- ✅ Parallel queries with `Promise.all` for count
- ✅ Results in **2 queries total**, not 1+N

### Query Patterns

| Endpoint | Query Count | Notes |
|----------|-------------|-------|
| `GET /applications` | 2 | 1 for applications, 1 for count |
| `GET /applications?includeJobPosting=true` | 2-3 | 1 for apps+jobs (JOIN), 1 for count |
| `GET /applications/:id` | 1 | Single application |
| `GET /applications/:id?includeJobPosting=true` | 1 | Single app with JOIN |

### Performance Improvement

For 100 applications with job postings:

- **Without eager loading (N+1):** 101 queries (1 + 100)
- **With eager loading:** 2-3 queries
- **Improvement:** **~97% fewer queries**

## Testing

### E2E Test: N+1 Prevention

See `test/e2e/performance/n-plus-one.e2e-spec.ts` for automated tests that verify query count:

```typescript
it('should NOT have N+1 query problem (max 3 queries for 10 applications)', async () => {
  // Enable Prisma query logging
  prisma.$on('query', (e) => queryCount++);

  await request(app.getHttpServer())
    .get('/api/v1/applications?includeJobPosting=true')
    .expect(200);

  // Should use ≤3 queries, not 1+10=11
  expect(queryCount).toBeLessThanOrEqual(3);
});
```

### Manual Testing with Prisma Logging

Enable query logging in development:

```typescript
// apps/api/src/prisma/prisma.service.ts
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});
```

Then watch logs when hitting endpoints:

```bash
curl http://localhost:3000/api/v1/applications?includeJobPosting=true \
  -H "Authorization: Bearer $TOKEN"
```

You should see:
1. `SELECT` applications with JOIN to job_postings
2. `SELECT COUNT(*)` for pagination
3. **Total: 2-3 queries**

## Prisma Eager Loading Strategies

Prisma uses two strategies for `include`:

### 1. JOIN Strategy (preferred)
```sql
SELECT a.*, jp.* 
FROM applications a
LEFT JOIN job_postings jp ON a.job_posting_id = jp.id
WHERE a.user_id = $1
ORDER BY a.created_at DESC
LIMIT 20;
```

### 2. IN Clause Strategy (fallback)
```sql
-- Query 1: Fetch applications
SELECT * FROM applications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20;

-- Query 2: Fetch related job postings in bulk
SELECT * FROM job_postings WHERE id IN ($1, $2, ..., $20);
```

Both strategies are efficient and prevent N+1 queries.

## Best Practices

### ✅ DO: Use `include` for Relations

```typescript
// Good: Eager load when needed
const applications = await prisma.application.findMany({
  include: { jobPosting: true },
});
```

### ❌ DON'T: Manually Fetch Relations

```typescript
// Bad: Causes N+1 queries
const applications = await prisma.application.findMany({});
for (const app of applications) {
  app.jobPosting = await prisma.jobPosting.findUnique({ 
    where: { id: app.jobPostingId } 
  });
}
```

### ✅ DO: Conditional Includes

```typescript
// Good: Only load when needed
include: {
  jobPosting: includeJobPosting,
  coverLetterTemplate: includeTemplates,
}
```

### ❌ DON'T: Always Include Large Relations

```typescript
// Bad: Loads unnecessary data
include: {
  jobPosting: true, // Always loaded even if not used
  coverLetterTemplate: true,
  resumeTemplate: true,
}
```

## Database Indexes

N+1 prevention is more effective with proper indexes:

```prisma
model Application {
  // ... fields
  
  @@index([userId, createdAt(sort: Desc)]) // Fast sorted queries
  @@index([jobPostingId]) // Fast JOIN on job postings
  @@unique([userId, jobPostingId]) // Prevent duplicates
}
```

See `docs/implementation/DATABASE_INDEX_STRATEGY.md` for details.

## Monitoring

### Production Checklist

- [ ] Enable slow query logging (queries > 100ms)
- [ ] Monitor query count per endpoint
- [ ] Set up alerts for query count spikes
- [ ] Use APM tools (Application Insights, Datadog, etc.)

### Expected Query Counts (Production)

| Endpoint | Users | Expected Queries | Alert Threshold |
|----------|-------|------------------|-----------------|
| GET /applications | 1,000 | 2-3 | > 5 |
| GET /applications?includeJobPosting=true | 1,000 | 2-3 | > 5 |
| GET /applications/:id | 1,000 | 1 | > 2 |

## Related Documentation

- [Pagination Implementation](./PAGINATION.md)
- [Database Index Strategy](./DATABASE_INDEX_STRATEGY.md)
- [Prisma Best Practices](https://www.prisma.io/docs/guides/performance-and-optimization)

## References

- [N+1 Query Problem Explained](https://stackoverflow.com/questions/97197/what-is-the-n1-selects-problem-in-orm-object-relational-mapping)
- [Prisma Relations](https://www.prisma.io/docs/concepts/components/prisma-client/relation-queries)
- [Prisma Performance](https://www.prisma.io/docs/guides/performance-and-optimization/query-optimization-performance)
