# Soft Delete Implementation

## Overview

This implementation adds soft delete functionality to Applications and Job Postings, preventing accidental permanent data loss.

## Changes Made

### 1. Database Schema (Prisma)

**File:** `apps/api/prisma/schema.prisma`

Added `deletedAt` field to both `Application` and `JobPosting` models:

```prisma
deletedAt DateTime? // Soft delete timestamp

@@index([userId, deletedAt]) // For efficient filtering
```

### 2. Migration

**File:** `apps/api/prisma/migrations/20251212215500_add_soft_delete_to_applications_and_job_postings/migration.sql`

Creates:

- `deletedAt` column on both tables
- Indexes for efficient querying

### 3. Applications Service

**File:** `apps/api/src/applications/applications.service.ts`

**Updated Methods:**

- `findAll()` - Added `includeDeleted` parameter (default: false) to filter soft-deleted items
- `delete()` - Changed to soft delete (sets `deletedAt` instead of removing record)

**New Methods:**

- `restore(userId, applicationId)` - Clears `deletedAt` to restore item
- `hardDelete(userId, applicationId)` - Permanently deletes item and files

### 4. Job Postings Service

**File:** `apps/api/src/job-postings/job-postings.service.ts`

**Updated Methods:**

- `listJobPostings()` - Added `includeDeleted` parameter
- `deleteJobPosting()` - Changed to soft delete

**New Methods:**

- `restoreJobPosting(userId, id)` - Restores soft-deleted posting
- `hardDeleteJobPosting(userId, id)` - Permanently deletes posting

### 5. Controllers

**Applications Controller:** `apps/api/src/applications/applications.controller.ts`

- `DELETE /applications/:id` - Soft delete (204 No Content)
- `PATCH /applications/:id/restore` - Restore deleted item (200 OK)
- `DELETE /applications/:id/permanent` - Hard delete (204 No Content)
- `GET /applications?includeDeleted=true` - List with deleted items

**Job Postings Controller:** `apps/api/src/job-postings/job-postings.controller.ts`

- `DELETE /job-postings/:id` - Soft delete
- `PATCH /job-postings/:id/restore` - Restore
- `DELETE /job-postings/:id/permanent` - Hard delete
- `GET /job-postings?includeDeleted=true` - List with deleted items

### 6. Cleanup Cron Job

**Files:**

- `apps/api/src/common/cron/cleanup.cron.ts`
- `apps/api/src/common/cron/cleanup-cron.module.ts`

**Features:**

- Applications cleanup: Runs daily at midnight (12:00 AM)
- Job postings cleanup: Runs daily at 12:05 AM (5 minutes after applications to avoid DB contention)
- Hard deletes items soft-deleted more than 30 days ago
- Respects `ENABLE_CRON_JOBS` environment variable
- Separate methods for applications and job postings
- Logs count of deleted items

**Registration:** `apps/api/src/app.module.ts`

## API Endpoints

### Applications

| Method | Endpoint                                   | Description       | Response                        |
| ------ | ------------------------------------------ | ----------------- | ------------------------------- |
| DELETE | `/api/v1/applications/:id`                 | Soft delete       | 204 No Content                  |
| PATCH  | `/api/v1/applications/:id/restore`         | Restore           | 200 OK (ApplicationResponseDto) |
| DELETE | `/api/v1/applications/:id/permanent`       | Hard delete       | 204 No Content                  |
| GET    | `/api/v1/applications?includeDeleted=true` | List with deleted | 200 OK (paginated)              |

### Job Postings

| Method | Endpoint                                   | Description       | Response                       |
| ------ | ------------------------------------------ | ----------------- | ------------------------------ |
| DELETE | `/api/v1/job-postings/:id`                 | Soft delete       | 204 No Content                 |
| PATCH  | `/api/v1/job-postings/:id/restore`         | Restore           | 200 OK (JobPostingResponseDto) |
| DELETE | `/api/v1/job-postings/:id/permanent`       | Hard delete       | 204 No Content                 |
| GET    | `/api/v1/job-postings?includeDeleted=true` | List with deleted | 200 OK (paginated)             |

## Behavior

### Soft Delete

- Sets `deletedAt` timestamp to current date/time
- Item remains in database
- Excluded from normal queries (`findAll`, `listJobPostings`)
- Can be restored within 30 days
- Can only soft delete items that aren't already deleted

### Restore

- Clears `deletedAt` field (sets to `null`)
- Item appears in normal queries again
- Can only restore items that are currently deleted

### Hard Delete

- Permanently removes from database
- For applications: Also deletes PDF files from storage
- Cannot be undone
- Used by cleanup cron or manual admin action

### Automatic Cleanup

- Applications: Runs daily at midnight (12:00 AM)
- Job postings: Runs daily at 12:05 AM (staggered to avoid DB contention)
- Only processes items where `deletedAt < 30 days ago`
- Disabled in development by default (`ENABLE_CRON_JOBS=false`)
- Logs results: `Deleted ${count} applications older than 30 days in ${duration}ms`

## Database Queries

**Filter out deleted items (default):**

```typescript
where: {
  userId,
  deletedAt: null
}
```

**Include deleted items:**

```typescript
where: {
  userId,
  deletedAt: includeDeleted ? undefined : null
}
```

**Find only deleted items:**

```typescript
where: {
  userId,
  deletedAt: { not: null }
}
```

**Find items for cleanup:**

```typescript
where: {
  deletedAt: {
    not: null,
    lt: thirtyDaysAgo // new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  }
}
```

## Testing

See `apps/api/test-soft-delete.md` for manual testing guide.

**Key Test Scenarios:**

1. Soft delete application → verify `deletedAt` is set
2. List applications → deleted items excluded
3. List with `includeDeleted=true` → deleted items included
4. Restore application → `deletedAt` cleared
5. Hard delete application → record removed, files deleted
6. Cron job cleanup → old items removed (requires ENABLE_CRON_JOBS=true)

## Configuration

**Environment Variables:**

- `ENABLE_CRON_JOBS` - Set to `true` to enable automatic cleanup (default: `false` in dev)

**Cleanup Schedule:**

- Frequency: Daily at midnight
- Retention: 30 days after soft delete
- Can be customized via cron expression in `cleanup.cron.ts`

## Security Considerations

1. **Authorization:** All endpoints verify user ownership via `userId`
2. **Validation:** Can only soft delete non-deleted items, can only restore deleted items
3. **Audit:** All deletions logged via existing logger
4. **Data Safety:** 30-day grace period before permanent deletion
5. **Storage Cleanup:** Hard delete removes associated files to prevent orphaned data

## Performance

**Indexes Added:**

- `applications_userId_deletedAt_idx` on `(userId, deletedAt)`
- `job_postings_userId_deletedAt_idx` on `(userId, deletedAt)`

**Benefits:**

- Efficient filtering of deleted items
- Fast queries for both active and deleted items
- Optimized cleanup queries for cron job

**Query Patterns:**

- List active items: Uses index for `deletedAt IS NULL` filter
- List deleted items: Uses index for `deletedAt IS NOT NULL` filter
- Cleanup query: Uses index for `deletedAt < cutoff` range scan

## Future Enhancements

1. **Frontend Trash Page:**
   - View all soft-deleted items in one place
   - Bulk restore/delete operations
   - Search and filter deleted items
   - Visual countdown to permanent deletion

2. **Admin Features:**
   - Hard delete permissions (only admins)
   - Audit log for all deletions
   - Restore history tracking

3. **User Notifications:**
   - Email before automatic cleanup
   - Reminder at 7 days, 1 day before deletion
   - Confirmation on manual hard delete

4. **Configurable Retention:**
   - Per-user retention settings
   - Different retention for applications vs. job postings
   - Premium users: longer retention

## Migration Instructions

**For existing databases:**

1. Run the migration: `npx prisma migrate deploy`
2. Verify indexes created: Check `applications_userId_deletedAt_idx` exists
3. Test soft delete on non-production data first
4. Enable cron jobs: Set `ENABLE_CRON_JOBS=true` (optional)

**Rollback Plan:**
If issues occur:

1. Keep `deletedAt` column (data integrity)
2. Restore previous service methods
3. Disable cron job
4. Create new migration to remove indexes if needed

## Compatibility

- **Backward Compatible:** Existing queries work unchanged (default: exclude deleted)
- **Breaking Changes:** None - new parameters are optional
- **API Version:** v1 (no version bump required)
- **Database:** PostgreSQL 12+ required (for nullable timestamp)
