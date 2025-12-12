# Soft Delete Manual Testing Guide

## Prerequisites
- Backend server running (`npm run start:dev`)
- User authenticated (use demo@smartapply.com / Demo123!)
- At least one application and job posting created

## API Endpoints to Test

### 1. Soft Delete Application
```bash
DELETE /api/v1/applications/:id
# Expected: 204 No Content
# Application should still exist in DB with deletedAt timestamp
```

### 2. List Applications (excludes deleted by default)
```bash
GET /api/v1/applications
# Expected: Deleted applications NOT in response
```

### 3. List Applications (include deleted)
```bash
GET /api/v1/applications?includeDeleted=true
# Expected: Deleted applications included in response
```

### 4. Restore Application
```bash
PATCH /api/v1/applications/:id/restore
# Expected: 200 OK with application data
# deletedAt should be null
```

### 5. Permanently Delete Application
```bash
DELETE /api/v1/applications/:id/permanent
# Expected: 204 No Content
# Application completely removed from DB
```

### 6. Soft Delete Job Posting
```bash
DELETE /api/v1/job-postings/:id
# Expected: 204 No Content
```

### 7. List Job Postings (excludes deleted)
```bash
GET /api/v1/job-postings
# Expected: Deleted job postings NOT in response
```

### 8. List Job Postings (include deleted)
```bash
GET /api/v1/job-postings?includeDeleted=true
# Expected: Deleted job postings included in response
```

### 9. Restore Job Posting
```bash
PATCH /api/v1/job-postings/:id/restore
# Expected: 200 OK with job posting data
```

### 10. Permanently Delete Job Posting
```bash
DELETE /api/v1/job-postings/:id/permanent
# Expected: 204 No Content
```

## Swagger UI Testing
Visit: http://localhost:3000/docs

1. Navigate to Applications or Job Postings section
2. Test each endpoint with the "Try it out" button
3. Verify responses match expected status codes

## Database Verification

```sql
-- Check soft-deleted applications
SELECT id, title, "deletedAt", "createdAt" 
FROM applications 
WHERE "deletedAt" IS NOT NULL;

-- Check soft-deleted job postings
SELECT id, title, "deletedAt", "createdAt" 
FROM job_postings 
WHERE "deletedAt" IS NOT NULL;

-- Check cleanup threshold (items older than 30 days)
SELECT COUNT(*) 
FROM applications 
WHERE "deletedAt" IS NOT NULL 
  AND "deletedAt" < NOW() - INTERVAL '30 days';
```

## Cron Job Testing

The cleanup cron runs daily at midnight. To test manually:

1. Set `ENABLE_CRON_JOBS=true` in .env
2. Create soft-deleted items with old timestamps
3. Wait for cron or trigger manually via code

Note: In development, `ENABLE_CRON_JOBS=false` by default.
