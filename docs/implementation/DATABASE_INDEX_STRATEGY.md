# Database Index Strategy

## Overview

This document describes the indexing strategy for Smart Apply's PostgreSQL database. Proper indexes are critical for query performance, especially as the application scales to 20k+ monthly users.

## Index Categories

### 1. List Query Indexes (Sorted by Creation Date)

These composite indexes optimize the most common query pattern: fetching a user's records sorted by creation date in descending order.

**Pattern:**

```sql
SELECT * FROM table WHERE userId = ? ORDER BY createdAt DESC LIMIT 20;
```

**Indexes:**

- `applications(userId, createdAt DESC)` - Application list queries
- `job_postings(userId, createdAt DESC)` - Job posting list queries
- `audit_logs(userId, createdAt DESC)` - Audit log queries

**Performance Impact:**

- Without index: Full table scan + sort (O(n log n))
- With index: Index scan only (O(log n))
- **Expected speedup: 100x+ for tables with 10k+ rows**

### 2. Unique Constraints (Data Integrity)

Prevents duplicate data at the database level, ensuring data integrity even under high concurrency.

**Constraint:**

- `applications(userId, jobPostingId)` UNIQUE - Prevents users from creating multiple applications for the same job posting

**Benefits:**

- Database-level enforcement (no race conditions)
- Immediate error feedback to application layer
- Prevents data corruption from concurrent requests

### 3. Cleanup Query Indexes (Cron Jobs)

These composite indexes optimize background cleanup jobs that delete expired records.

**Pattern:**

```sql
DELETE FROM refresh_tokens WHERE userId = ? AND expiresAt < NOW();
DELETE FROM sessions WHERE userId = ? AND expiresAt < NOW();
```

**Indexes:**

- `refresh_tokens(userId, expiresAt)` - Refresh token cleanup
- `sessions(userId, expiresAt)` - Session cleanup

**Performance Impact:**

- Enables efficient batch deletion without table locks
- Critical for daily cleanup cron jobs at scale

### 4. Existing Indexes (Pre-existing)

These indexes were already in place and serve other query patterns:

- `users(email)` - Login queries
- `applications(status)` - Status-based filtering
- `applications(userId, applicationStatus)` - User + status filtering
- `sessions(userId, isActive)` - Active session queries
- `sessions(userId, lastActiveAt)` - Recent session queries
- `sessions(expiresAt)` - Global cleanup queries

## Migration Details

**Migration File:** `20251211092900_add_missing_database_indexes/migration.sql`

**Date Created:** December 11, 2025

**SQL Commands:**

```sql
-- Application indexes
CREATE INDEX "applications_userId_createdAt_idx" ON "applications"("userId", "createdAt" DESC);
CREATE UNIQUE INDEX "applications_userId_jobPostingId_key" ON "applications"("userId", "jobPostingId");

-- JobPosting indexes
CREATE INDEX "job_postings_userId_createdAt_idx" ON "job_postings"("userId", "createdAt" DESC);

-- RefreshToken indexes
CREATE INDEX "refresh_tokens_userId_expiresAt_idx" ON "refresh_tokens"("userId", "expiresAt");

-- Session indexes
CREATE INDEX "sessions_userId_expiresAt_idx" ON "sessions"("userId", "expiresAt");

-- AuditLog indexes
CREATE INDEX "audit_logs_userId_createdAt_idx" ON "audit_logs"("userId", "createdAt" DESC);
```

## Production Deployment Strategy

### Safe Rollout Checklist

1. **Staging Environment First**

   ```bash
   # Run migration in staging
   cd apps/api
   npm run prisma:migrate -- deploy
   ```

2. **Verify Index Creation**

   ```sql
   -- Check indexes were created
   SELECT
     schemaname,
     tablename,
     indexname,
     indexdef
   FROM pg_indexes
   WHERE tablename IN ('applications', 'job_postings', 'refresh_tokens', 'sessions', 'audit_logs')
   ORDER BY tablename, indexname;
   ```

3. **Test Query Performance**

   ```sql
   -- Verify index usage with EXPLAIN ANALYZE
   EXPLAIN ANALYZE
   SELECT * FROM applications
   WHERE "userId" = 'test-user-id'
   ORDER BY "createdAt" DESC
   LIMIT 20;

   -- Should show: "Index Scan using applications_userId_createdAt_idx"
   ```

4. **Production Deployment (Zero Downtime)**

   **Option A: Standard Migration**

   ```bash
   npm run prisma:migrate -- deploy
   ```

   **Option B: Concurrent Index Creation (for large tables)**

   ```sql
   -- For tables with >100k rows, use CONCURRENTLY to avoid locks
   CREATE INDEX CONCURRENTLY "applications_userId_createdAt_idx"
   ON "applications"("userId", "createdAt" DESC);

   CREATE UNIQUE INDEX CONCURRENTLY "applications_userId_jobPostingId_key"
   ON "applications"("userId", "jobPostingId");

   -- Repeat for other indexes...
   ```

5. **Monitor Performance**
   - Watch query execution times in application logs
   - Monitor database CPU and I/O metrics
   - Check for slow query logs

### Rollback Plan

If issues occur, indexes can be dropped without data loss:

```sql
-- Drop indexes (rollback)
DROP INDEX IF EXISTS "applications_userId_createdAt_idx";
DROP INDEX IF EXISTS "applications_userId_jobPostingId_key";
DROP INDEX IF EXISTS "job_postings_userId_createdAt_idx";
DROP INDEX IF EXISTS "refresh_tokens_userId_expiresAt_idx";
DROP INDEX IF EXISTS "sessions_userId_expiresAt_idx";
DROP INDEX IF EXISTS "audit_logs_userId_createdAt_idx";
```

## Expected Performance Improvements

### Before Indexes (10k users, 50k applications)

| Query                               | Execution Time         |
| ----------------------------------- | ---------------------- |
| List user applications (sorted)     | ~500ms                 |
| Create duplicate application        | ~200ms (no prevention) |
| List user job postings (sorted)     | ~300ms                 |
| Cleanup expired tokens (1k users)   | ~2000ms                |
| Cleanup expired sessions (1k users) | ~1500ms                |

### After Indexes

| Query                               | Execution Time   | Improvement        |
| ----------------------------------- | ---------------- | ------------------ |
| List user applications (sorted)     | ~5ms             | **100x faster**    |
| Create duplicate application        | ~5ms (prevented) | Instant prevention |
| List user job postings (sorted)     | ~3ms             | **100x faster**    |
| Cleanup expired tokens (1k users)   | ~50ms            | **40x faster**     |
| Cleanup expired sessions (1k users) | ~30ms            | **50x faster**     |

## Index Maintenance

PostgreSQL automatically maintains indexes. However, for optimal performance:

1. **Regular VACUUM**: Run `VACUUM ANALYZE` weekly to update statistics

   ```sql
   VACUUM ANALYZE applications;
   VACUUM ANALYZE job_postings;
   VACUUM ANALYZE refresh_tokens;
   VACUUM ANALYZE sessions;
   VACUUM ANALYZE audit_logs;
   ```

2. **Monitor Index Usage**

   ```sql
   -- Check if indexes are being used
   SELECT
     schemaname,
     tablename,
     indexname,
     idx_scan,
     idx_tup_read,
     idx_tup_fetch
   FROM pg_stat_user_indexes
   WHERE tablename IN ('applications', 'job_postings', 'refresh_tokens', 'sessions', 'audit_logs')
   ORDER BY idx_scan DESC;
   ```

3. **Reindex if Necessary** (rarely needed)

   ```sql
   REINDEX TABLE applications;
   ```

## Query Optimization Tips

### Using the Indexes Effectively

**Good Query (uses index):**

```typescript
// Applications sorted by creation date
const apps = await prisma.application.findMany({
  where: { userId },
  orderBy: { createdAt: 'desc' },
  take: 20,
});
// Uses: applications_userId_createdAt_idx ✅
```

**Bad Query (doesn't use index):**

```typescript
// Missing orderBy - doesn't use composite index
const apps = await prisma.application.findMany({
  where: { userId },
  take: 20,
});
// Uses: applications_userId (basic index) ❌
```

**Duplicate Prevention (uses unique constraint):**

```typescript
try {
  await prisma.application.create({
    data: { userId, jobPostingId, ... },
  });
} catch (error) {
  if (error.code === 'P2002') {
    throw new ConflictException('Application already exists');
  }
}
// Prevented at database level ✅
```

## Related Documentation

- [Prisma Schema](../../apps/api/prisma/schema.prisma) - Database schema definition
- [Migration Files](../../apps/api/prisma/migrations/) - All database migrations
- [Performance Testing](../testing/TESTING_STRATEGY.md) - How to test query performance

## Issue References

- **GitHub Issue:** #198 - [CRITICAL] Add missing database indexes for critical queries
- **Priority:** P0 (Critical - prevents scaling)
- **Estimate:** 2 hours implementation + 1 hour production rollout

## Changelog

- **2025-12-11**: Initial implementation - Added 6 critical indexes for scalability
