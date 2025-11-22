# Audit Logger

The AuditLoggerService provides structured logging for security events in Smart Apply.

## Quick Start

```typescript
import { AuditLoggerService } from '../common/audit-logger';

@Injectable()
export class YourService {
  constructor(private auditLogger: AuditLoggerService) {}

  async someSecurityOperation(req: Request) {
    // Log security event
    this.auditLogger.log({
      eventType: AuditEventType.UNAUTHORIZED_ACCESS,
      userId: req.user?.id,
      ip: this.getClientIp(req),
      userAgent: req.headers['user-agent'] || 'unknown',
      timestamp: new Date(),
      severity: 'warning',
      metadata: { endpoint: req.url },
    });
  }
}
```

## Pre-built Methods

The service provides convenience methods for common security events:

### Authentication
- `logLoginAttempt(email, success, req, userId?)` - Login attempts
- `logRegistration(email, userId, req)` - New user registration
- `logLogout(userId, req)` - User logout
- `logRefreshTokenUsed(userId, email, req)` - Token refresh

### Security
- `logRateLimitViolation(userId, endpoint, req)` - Rate limit exceeded
- `logCsrfValidationFailed(userId, req)` - CSRF validation failed
- `logUnauthorizedAccess(userId, endpoint, req)` - Unauthorized access attempt

### Account Changes
- `logPasswordChange(userId, req)` - Password updated
- `logProfileUpdate(userId, req, metadata?)` - Profile modified

## Event Types

```typescript
enum AuditEventType {
  // Authentication
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILED = 'LOGIN_FAILED',
  LOGOUT = 'LOGOUT',
  REGISTRATION = 'REGISTRATION',
  REFRESH_TOKEN_USED = 'REFRESH_TOKEN_USED',
  
  // Security
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  CSRF_VALIDATION_FAILED = 'CSRF_VALIDATION_FAILED',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
  
  // Account Changes
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',
  PROFILE_UPDATED = 'PROFILE_UPDATED',
}
```

## Log Structure

Every log entry includes:
- `eventType`: Security event identifier
- `timestamp`: ISO 8601 timestamp
- `ip`: Client IP address (extracted from headers)
- `userAgent`: Client user agent
- `severity`: 'info' | 'warning' | 'critical'
- `userId`: User ID (optional, if authenticated)
- `email`: User email (optional)
- `metadata`: Additional event-specific data (optional)

## Configuration

Logs are automatically rotated daily:
- **Location:** `logs/audit-YYYY-MM-DD.log`
- **Rotation:** Daily at midnight
- **Retention:** 90 days
- **Max Size:** 20MB per file
- **Format:** Structured JSON

## Testing

```bash
npm run test:e2e -- audit-logging.e2e-spec.ts
```

## Documentation

See [docs/AUDIT_LOGGING.md](../../../../../docs/AUDIT_LOGGING.md) for complete documentation.

## Security & Compliance

✅ PII-compliant (no passwords logged)  
✅ GDPR-compliant (90-day retention)  
✅ ISO 27001 controls supported  
✅ Non-blocking async I/O  

## Integration Examples

### In AuthService
```typescript
async login(dto: LoginDto, req: Request) {
  const user = await this.findUser(dto.email);
  
  if (!user || !(await this.verifyPassword(user, dto.password))) {
    this.auditLogger.logLoginAttempt(dto.email, false, req, user?.id);
    throw new UnauthorizedException('Invalid credentials');
  }
  
  this.auditLogger.logLoginAttempt(dto.email, true, req, user.id);
  return this.generateTokens(user);
}
```

### In Guards
```typescript
async canActivate(context: ExecutionContext): Promise<boolean> {
  try {
    return await super.canActivate(context);
  } catch (error) {
    if (error instanceof ThrottlerException) {
      const request = context.switchToHttp().getRequest();
      this.auditLogger.logRateLimitViolation(
        request.user?.id,
        request.url,
        request
      );
    }
    throw error;
  }
}
```
