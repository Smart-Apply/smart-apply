# Rate Limiting Implementation

## Overview

This application implements strict rate limiting to prevent brute force attacks, account enumeration, and API abuse. The implementation uses NestJS Throttler with multiple named configurations for different endpoint types.

## Configuration

### Environment Variables

```bash
# Default rate limiting (general API endpoints)
RATE_LIMIT_TTL=900          # 15 minutes in seconds
RATE_LIMIT_MAX=100          # Max 100 requests per window

# Auth endpoints (stricter limits)
RATE_LIMIT_AUTH_TTL=900     # 15 minutes in seconds
RATE_LIMIT_AUTH_MAX=5       # Max 5 requests per window
```

### Rate Limit Strategy

| Endpoint                | Limit | Window | Tracking    |
| ----------------------- | ----- | ------ | ----------- |
| `/api/v1/auth/login`    | 5     | 15 min | Per IP      |
| `/api/v1/auth/register` | 5     | 15 min | Per IP      |
| Other protected routes  | 100   | 15 min | Per User ID |

## Implementation Details

### Named Throttlers

The application configures multiple throttler contexts in `app.module.ts`:

```typescript
ThrottlerModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    throttlers: [
      {
        name: 'default',
        ttl: config.rateLimitTtl,      // 900000ms (15 min)
        limit: config.rateLimitMax,     // 100
      },
      {
        name: 'auth',
        ttl: config.rateLimitAuthTtl,  // 900000ms (15 min)
        limit: config.rateLimitAuthMax, // 5
      },
    ],
  }),
}),
```

### Custom Decorator

Use the `@UseThrottler(name)` decorator to apply specific rate limits:

```typescript
import { UseThrottler } from '../common/decorators/throttle.decorator';

@Controller('auth')
export class AuthController {
  @Public()
  @UseThrottler('auth')  // Apply strict auth throttler
  @Post('login')
  async login(@Body() dto: LoginDto) {
    // ...
  }
}
```

### Custom Guard

The `CustomThrottlerGuard` extends NestJS `ThrottlerGuard` to:

1. **Select throttler** based on `@UseThrottler()` decorator
2. **Add rate limit headers** to all responses:
   - `X-RateLimit-Limit`: Maximum requests allowed
   - `X-RateLimit-Remaining`: Requests remaining in window
   - `X-RateLimit-Reset`: Unix timestamp when limit resets
   - `Retry-After`: Seconds to wait (only on 429 error)

3. **Track requests** differently based on context:
   - **Public routes (auth)**: Track by IP address
   - **Protected routes**: Track by authenticated user ID

## Response Headers

### Successful Request

```http
HTTP/1.1 200 OK
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 4
X-RateLimit-Reset: 1700000000000
```

### Rate Limit Exceeded

```http
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 0
Retry-After: 900

{
  "statusCode": 429,
  "message": "ThrottlerException: Too Many Requests"
}
```

## Testing

### Unit Tests

```bash
npm test -- custom-throttler.guard.spec.ts
```

Tests cover:

- Throttler selection based on decorator
- Tracker identification (IP vs User ID)
- Key generation for rate limit storage

### E2E Tests

```bash
npm run test:e2e -- rate-limit.e2e-spec.ts
```

Tests cover:

- Auth endpoints enforce 5 req/15min limit
- Protected endpoints use 100 req/15min limit
- Rate limit headers are present
- 429 error with Retry-After header

## Security Impact

This implementation prevents:

- ✅ **Brute force attacks**: Limits login attempts to 5 per 15 minutes
- ✅ **Account enumeration**: Same rate limit applies to failed/successful logins
- ✅ **Credential stuffing**: IP-based tracking prevents automated attacks
- ✅ **API abuse**: General rate limit of 100 req/15min prevents resource exhaustion

## Future Enhancements

- [ ] Redis storage for distributed rate limiting (multi-instance deployments)
- [ ] Different limits based on user subscription tier
- [ ] Exponential backoff for repeated violations
- [ ] Rate limit monitoring and alerting
- [ ] Whitelist for trusted IPs (internal services, monitoring tools)
