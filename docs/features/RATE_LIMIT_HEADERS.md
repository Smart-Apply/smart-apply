# Rate Limit Headers Exposure

## Overview

This document describes how rate limit headers are exposed to the frontend via CORS and how the frontend handles them to provide a better user experience.

## Problem

Previously, rate limit headers were set by the backend but not exposed via CORS configuration. This meant:
- Frontend couldn't access the headers to show users how many requests they have remaining
- Users would hit rate limits without any warning
- No way to implement smart retry logic based on the `Retry-After` header

## Solution

### Backend Changes

#### 1. CORS Configuration (`apps/api/src/main.ts`)

The CORS configuration now explicitly exposes rate limit headers:

```typescript
app.enableCors({
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  exposedHeaders: [
    'X-RateLimit-Limit',      // Total allowed requests in the time window
    'X-RateLimit-Remaining',  // Remaining requests in current window
    'X-RateLimit-Reset',      // Timestamp when the limit resets (milliseconds)
    'Retry-After',            // Seconds to wait before retrying (on 429)
  ],
});
```

#### 2. Custom Throttler Guard (`apps/api/src/common/guards/custom-throttler.guard.ts`)

The `CustomThrottlerGuard` was enhanced to:
- Override the `handleRequest` method to properly track request counts
- Set comprehensive rate limit headers on every request:
  - `X-RateLimit-Limit`: The total number of requests allowed in the time window
  - `X-RateLimit-Remaining`: How many requests are left in the current window
  - `X-RateLimit-Reset`: Unix timestamp (in milliseconds) when the limit resets
  - `Retry-After`: Number of seconds to wait (only on 429 responses)

**Implementation Details:**

```typescript
protected async handleRequest(
  context: ExecutionContext,
  limit: number,
  ttl: number,
  throttler: any,
): Promise<boolean> {
  const request = context.switchToHttp().getRequest();
  const response = context.switchToHttp().getResponse();
  const tracker = await this.getTracker(request);
  const key = this.generateKey(context, tracker, throttler.name || 'default');

  // Increment counter and get total hits
  const { totalHits } = await this.storageService.increment(key, ttl);

  // Check if limit exceeded
  if (totalHits > limit) {
    // Set headers for exceeded limit
    response.setHeader('X-RateLimit-Limit', limit.toString());
    response.setHeader('X-RateLimit-Remaining', '0');
    response.setHeader('X-RateLimit-Reset', (Date.now() + ttl).toString());
    response.setHeader('Retry-After', Math.ceil(ttl / 1000).toString());
    
    throw new ThrottlerException();
  }

  // Calculate remaining requests
  const remaining = Math.max(0, limit - totalHits);

  // Set headers on successful request
  response.setHeader('X-RateLimit-Limit', limit.toString());
  response.setHeader('X-RateLimit-Remaining', remaining.toString());
  response.setHeader('X-RateLimit-Reset', (Date.now() + ttl).toString());

  return true;
}
```

### Frontend Changes

#### 1. API Client (`apps/web/src/lib/api-client.ts`)

The `apiRequest` function now:
- Extracts rate limit headers from every response
- Shows a warning toast when less than 10 requests remain
- Handles 429 errors with user-friendly German messages

**Header Extraction:**

```typescript
// Extract rate limit headers
const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining');
const rateLimitReset = response.headers.get('X-RateLimit-Reset');
const rateLimitLimit = response.headers.get('X-RateLimit-Limit');

// Warn user if close to limit
if (rateLimitRemaining && rateLimitLimit && parseInt(rateLimitRemaining) < 10) {
  const resetTime = rateLimitReset ? parseInt(rateLimitReset) : Date.now();
  const minutesUntilReset = Math.ceil((resetTime - Date.now()) / 60000);
  
  toast.warning(
    `Nur noch ${rateLimitRemaining} Anfragen verfügbar. ` +
    `Limit wird zurückgesetzt in ${minutesUntilReset} Minute${minutesUntilReset !== 1 ? 'n' : ''}.`
  );
}
```

**429 Error Handling:**

```typescript
if (response.status === 429) {
  const retryAfter = response.headers.get('Retry-After');
  const retrySeconds = retryAfter ? parseInt(retryAfter) : 60;
  const retryMinutes = Math.ceil(retrySeconds / 60);
  
  throw new ApiError(
    429,
    `Zu viele Anfragen. Bitte warte ${retryMinutes} Minute${retryMinutes !== 1 ? 'n' : ''} und versuche es erneut.`,
    errorData
  );
}
```

## Rate Limit Configuration

### Default Limits

- **Standard Endpoints**: 100 requests per 15 minutes
- **Auth Endpoints** (login, register): 5 requests per 15 minutes (strict)
- **Health Check**: 600 requests per minute (10/sec for polling)

### Environment Variables

```bash
# Standard rate limit (applies to most endpoints)
RATE_LIMIT_TTL=900           # 15 minutes in seconds
RATE_LIMIT_MAX=100           # 100 requests per 15 min

# Auth endpoints (strict limit to prevent brute force)
RATE_LIMIT_AUTH_TTL=900      # 15 minutes
RATE_LIMIT_AUTH_MAX=5        # 5 attempts per 15 min
```

## Testing

### Backend E2E Tests

The rate limit E2E tests (`apps/api/test/e2e/security/rate-limit.e2e-spec.ts`) verify:

1. **Header Presence**: All rate limit headers are present on every request
   ```typescript
   expect(response.headers['x-ratelimit-limit']).toBe('5');
   expect(response.headers['x-ratelimit-remaining']).toBeDefined();
   expect(response.headers['x-ratelimit-reset']).toBeDefined();
   ```

2. **CORS Exposure**: Headers are exposed via `Access-Control-Expose-Headers`
   ```typescript
   const exposedHeaders = response.headers['access-control-expose-headers'];
   expect(exposedHeaders).toContain('X-RateLimit-Limit');
   expect(exposedHeaders).toContain('X-RateLimit-Remaining');
   expect(exposedHeaders).toContain('X-RateLimit-Reset');
   expect(exposedHeaders).toContain('Retry-After');
   ```

3. **Reset Timestamp**: `X-RateLimit-Reset` is a timestamp in the future
   ```typescript
   const resetTimestamp = parseInt(response.headers['x-ratelimit-reset']);
   expect(resetTimestamp).toBeGreaterThan(Date.now());
   ```

### Manual Testing

To manually test rate limit headers:

1. **Start the backend**:
   ```bash
   cd apps/api
   NODE_ENV=production npm run start:dev
   ```

2. **Make a test request**:
   ```bash
   curl -X POST http://localhost:3000/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -H "Origin: http://localhost:3001" \
     -d '{"email":"test@example.com","password":"wrong"}' \
     -i
   ```

3. **Verify headers in response**:
   ```
   X-RateLimit-Limit: 5
   X-RateLimit-Remaining: 4
   X-RateLimit-Reset: 1702408935123
   Access-Control-Expose-Headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After
   ```

4. **Trigger rate limit** (make 6+ requests):
   ```
   HTTP/1.1 429 Too Many Requests
   X-RateLimit-Limit: 5
   X-RateLimit-Remaining: 0
   X-RateLimit-Reset: 1702408935123
   Retry-After: 900
   ```

## User Experience Improvements

### Before
- Users hit rate limits without warning
- No indication of how many requests are left
- Generic error messages on 429 responses
- No way to know when they can retry

### After
- ⚠️ **Proactive Warning**: Toast notification when < 10 requests remaining
- 📊 **Visibility**: Users can see exactly how many requests they have left
- ⏰ **Clear Retry Time**: User-friendly German message tells them when they can retry
- 🔄 **Smart Retry Logic**: Frontend can implement automatic retry with proper delays

## Future Enhancements

### Optional: Rate Limit Indicator Component

For power users, you can add a rate limit indicator in the dashboard header:

```tsx
// apps/web/src/components/rate-limit-indicator.tsx
export function RateLimitIndicator() {
  const { remaining, limit, reset } = useRateLimit();
  
  if (!remaining) return null;
  
  const percentage = (remaining / limit) * 100;
  
  return (
    <div className="text-xs text-muted-foreground">
      <Progress value={percentage} className="h-1 w-20" />
      <span>{remaining}/{limit} Anfragen</span>
    </div>
  );
}
```

### Potential Improvements

1. **Client-side rate limit tracking**: Store rate limit state in Zustand/localStorage
2. **Automatic request throttling**: Delay requests when close to limit
3. **Request queue**: Queue requests when limit is exceeded, auto-retry when reset
4. **Per-endpoint tracking**: Track limits separately for different endpoint groups

## Security Considerations

- Rate limit headers do NOT expose sensitive information
- Limits are the same for all users (no user-specific information leaked)
- Headers help users understand the system, reducing frustration
- Retry-After prevents unnecessary request storms

## Related Documentation

- [CORS Security](../security/CORS_SECURITY.md)
- [Rate Limiting Strategy](../security/RATE_LIMITING.md)
- [Error Handling](./ERROR_CODES.md)
