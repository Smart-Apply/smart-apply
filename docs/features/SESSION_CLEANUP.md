# Session and Refresh Token Cleanup

## Overview

Smart Apply implements automated cleanup of expired sessions and refresh tokens to prevent database bloat and maintain optimal performance at scale.

## Problem Statement

Without cleanup, session and refresh token tables grow indefinitely:

- **20k users** × **5 sessions/user** × **365 days** = **36.5M expired sessions**
- Database table bloat (100GB+)
- Slow authentication queries
- Increased storage costs

## Solution

Automated daily cron jobs delete:

1. **Sessions**: Expired, old (90+ days), or revoked (30+ days)
2. **Refresh Tokens**: Expired or revoked (7+ days)

## Architecture

### Cron Schedule

| Job                   | Time | Frequency | Target                           |
| --------------------- | ---- | --------- | -------------------------------- |
| Refresh Token Cleanup | 2 AM | Daily     | Expired/revoked tokens (7+ days) |
| Session Cleanup       | 3 AM | Daily     | Expired/revoked/old sessions     |

### Cleanup Logic

#### Session Cleanup (`SessionService.cleanupExpiredSessions()`)

Permanently **deletes** sessions that meet ANY of these conditions:

1. **Expired**: `expiresAt < now`
2. **Revoked (old)**: `isActive = false AND revokedAt < now - 30 days`
3. **Old**: `createdAt < now - 90 days` (data retention policy)

```typescript
await prisma.session.deleteMany({
  where: {
    OR: [
      { expiresAt: { lt: now } },
      {
        AND: [{ isActive: false }, { revokedAt: { lt: revokedCleanupDate } }],
      },
      { createdAt: { lt: oldSessionCleanupDate } },
    ],
  },
});
```

#### Refresh Token Cleanup (`SessionService.cleanupExpiredRefreshTokens()`)

Permanently **deletes** tokens that meet ANY of these conditions:

1. **Expired**: `expiresAt < now`
2. **Revoked (old)**: `isRevoked = true AND createdAt < now - 7 days`

```typescript
await prisma.refreshToken.deleteMany({
  where: {
    OR: [
      { expiresAt: { lt: now } },
      {
        AND: [{ isRevoked: true }, { createdAt: { lt: revokedCleanupDate } }],
      },
    ],
  },
});
```

## Configuration

### Environment Variables

```bash
# .env or .env.example
ENABLE_CRON_JOBS=false  # Set to 'true' in production
```

- **Development**: `false` (disable cleanup to preserve test data)
- **Production**: `true` (enable cleanup to prevent bloat)

### Cleanup Thresholds (Constants)

Defined in `apps/api/src/auth/session.constants.ts`:

```typescript
// Session expiration (default: 30 days)
export const SESSION_EXPIRATION_DAYS = 30;

// Delete revoked sessions after 30 days
export const REVOKED_SESSION_CLEANUP_DAYS = 30;

// Delete ALL sessions after 90 days (data retention)
export const OLD_SESSION_CLEANUP_DAYS = 90;

// Delete revoked refresh tokens after 7 days
export const REVOKED_REFRESH_TOKEN_CLEANUP_DAYS = 7;
```

**Customization**: Modify constants to adjust retention periods based on compliance requirements.

## Implementation Details

### Files

| File                       | Purpose                              |
| -------------------------- | ------------------------------------ |
| `session.service.ts`       | Cleanup methods                      |
| `session-cleanup.cron.ts`  | Cron job scheduler                   |
| `session.constants.ts`     | Retention periods                    |
| `config/env.schema.ts`     | Environment variable schema          |
| `config/config.service.ts` | Config service with `enableCronJobs` |

### Logging

Each cleanup job logs:

- Start time
- Number of deleted records
- Duration (milliseconds)
- Errors (if any)

**Example Log Output**:

```text
[SessionCleanupCron] Starting refresh token cleanup...
[SessionCleanupCron] Refresh token cleanup completed. Deleted 143 expired/revoked tokens in 87ms

[SessionCleanupCron] Starting session cleanup...
[SessionCleanupCron] Session cleanup completed. Deleted 512 expired/revoked/old sessions in 124ms
```

## Testing

### Manual Testing (Development)

Test cleanup with a shorter schedule:

```typescript
// session-cleanup.cron.ts (temporary change)
@Cron('*/10 * * * * *') // Every 10 seconds
async cleanupExpiredSessions() {
  // ...
}
```

**Steps**:

1. Set `ENABLE_CRON_JOBS=true`
2. Change cron schedule to `*/10 * * * * *`
3. Start API: `npm run start:dev`
4. Create expired sessions manually in DB
5. Observe logs every 10 seconds
6. **Revert** schedule before committing

### Automated Tests

**Unit Tests** (`src/auth/__tests__/unit/session-cleanup.spec.ts`):

- Mock Prisma calls
- Verify correct WHERE conditions
- Test environment flag behavior

**E2E Tests** (`test/e2e/auth/session-cleanup.e2e-spec.ts`):

- Create expired/revoked/old sessions in test DB
- Run cleanup methods
- Verify sessions are deleted
- Verify active sessions are preserved

Run tests:

```bash
cd apps/api
npm run test -- session-cleanup.spec.ts
npm run test:e2e -- session-cleanup.e2e-spec.ts
```

## Database Indexes

Cleanup queries are optimized with indexes:

```prisma
// Session model
@@index([userId, expiresAt])
@@index([expiresAt])

// RefreshToken model
@@index([userId, expiresAt])
```

These indexes ensure cleanup queries execute in **< 100ms** even with millions of records.

## Performance Impact

### Estimated Cleanup Times (at scale)

| Records | Sessions | Refresh Tokens |
| ------- | -------- | -------------- |
| 10k     | 15ms     | 10ms           |
| 100k    | 80ms     | 50ms           |
| 1M      | 500ms    | 300ms          |
| 10M     | 5s       | 3s             |

**Note**: Cleanup runs at 2-3 AM when traffic is lowest.

### Storage Savings

Assuming 20k users with 5 sessions each:

- **Without cleanup**: 36.5M sessions/year × 500 bytes = **18GB**
- **With cleanup**: Max 100k active sessions × 500 bytes = **50MB**
- **Savings**: **99.7%** reduction

## Production Deployment

### Azure Container Apps (ACA)

Cron jobs run automatically in the API container. No additional configuration required.

**Verify**:

```bash
# Check logs in Azure Portal
az containerapp logs show \
  --name smart-apply-api \
  --resource-group smart-apply-rg \
  --follow
```

### Alternative: Azure Functions (Timer Trigger)

For completely serverless cleanup:

```typescript
// functions/session-cleanup/index.ts
import { AzureFunction, Context } from "@azure/functions";
import { SessionService } from "../../src/auth/session.service";

const timerTrigger: AzureFunction = async function (context: Context, myTimer: any): Promise<void> {
  const sessionService = new SessionService(prisma);
  await sessionService.cleanupExpiredSessions();
  await sessionService.cleanupExpiredRefreshTokens();
};

export default timerTrigger;
```

**function.json**:

```json
{
  "bindings": [
    {
      "name": "myTimer",
      "type": "timerTrigger",
      "direction": "in",
      "schedule": "0 0 2 * * *"
    }
  ]
}
```

## Monitoring

### Key Metrics

Track these in production:

1. **Cleanup count**: Number of deleted records per run
2. **Cleanup duration**: Execution time (should be < 1s)
3. **Failure rate**: Number of failed cleanup jobs
4. **Table size**: `sessions` and `refresh_tokens` table sizes

### Alerts

Set up alerts for:

- Cleanup failures (3+ in a row)
- Cleanup duration > 5s (indicates missing indexes)
- Table size > 1GB (indicates cleanup not running)

### Azure Application Insights Query

```kusto
traces
| where message contains "cleanup completed"
| extend deletedCount = extract(@"Deleted (\d+)", 1, message)
| summarize avg(todouble(deletedCount)), max(todouble(deletedCount)) by bin(timestamp, 1d)
```

## Security Considerations

### Data Retention Compliance

**GDPR Article 5(1)(e)**: Data must not be kept longer than necessary.

Smart Apply's cleanup policy:

- **Sessions**: Max 90 days (exceeds typical 30-day requirement)
- **Refresh tokens**: 7 days after revocation (audit trail)

**Customization**: Adjust `OLD_SESSION_CLEANUP_DAYS` for stricter compliance.

### Audit Trail

Revoked sessions/tokens are kept for a grace period before deletion:

- **Sessions**: 30 days (security incident investigation)
- **Tokens**: 7 days (token rotation debugging)

This allows forensic analysis while preventing indefinite storage.

## Troubleshooting

### Cleanup Not Running

**Symptoms**: Session count grows indefinitely

**Check**:

1. `ENABLE_CRON_JOBS=true` in production `.env`
2. No errors in logs: `grep -i "cleanup" /var/log/app.log`
3. `SessionCleanupCron` is registered in `auth.module.ts`

**Fix**:

```bash
# Manually trigger cleanup (temporary workaround)
curl -X POST http://localhost:3000/api/v1/internal/cleanup \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### Cleanup Too Slow

**Symptoms**: Cleanup duration > 5s

**Check**:

1. Missing indexes: `EXPLAIN ANALYZE SELECT * FROM sessions WHERE expiresAt < NOW();`
2. Large delete batches: Add `LIMIT` to `deleteMany`

**Fix**:

```typescript
// Batch delete in chunks of 10k
const batchSize = 10000;
let totalDeleted = 0;

while (true) {
  const result = await prisma.session.deleteMany({
    where: { /* cleanup conditions */ },
    take: batchSize,
  });

  totalDeleted += result.count;
  if (result.count < batchSize) break;
}
```

### Cleanup Deletes Active Sessions

**Symptoms**: Users logged out unexpectedly

**Check**:

1. Incorrect `expiresAt` calculation in session creation
2. Server clock drift (sessions marked expired prematurely)

**Fix**:

```bash
# Verify server time is correct
date
timedatectl
```

## Future Enhancements

### Soft Delete (Archive)

Instead of hard delete, archive old sessions:

```typescript
await prisma.sessionArchive.createMany({
  data: oldSessions.map((s) => ({ ...s, archivedAt: new Date() })),
});
await prisma.session.deleteMany({ where: { id: { in: oldSessionIds } } });
```

**Benefits**:

- Retain data for analytics
- Faster purge (simple DELETE)

**Drawbacks**:

- Requires archive table + migration script

### Incremental Cleanup

Run cleanup hourly instead of daily:

```typescript
@Cron(CronExpression.EVERY_HOUR)
async cleanupExpiredSessionsIncremental() {
  // Only delete sessions expired > 1 hour ago
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  await prisma.session.deleteMany({
    where: { expiresAt: { lt: oneHourAgo } },
  });
}
```

**Benefits**:

- Smaller batches (faster queries)
- More real-time cleanup

## References

- [NestJS Scheduler](https://docs.nestjs.com/techniques/task-scheduling)
- [Prisma Batch Operations](https://www.prisma.io/docs/concepts/components/prisma-client/batch-operations)
- [GDPR Data Retention](https://gdpr.eu/data-retention/)
- [PostgreSQL VACUUM](https://www.postgresql.org/docs/current/sql-vacuum.html)
