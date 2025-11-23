# Audit Logging

Smart Apply implements comprehensive audit logging for security events using winston with daily rotation.

## Overview

Audit logging tracks all security-relevant events including authentication attempts, account modifications, rate limit violations, and suspicious activities. Logs are stored in both structured JSON files (with 90-day retention) and optionally in the database for critical events.

## Architecture

### AuditLoggerService

Located in `apps/api/src/common/audit-logger/audit-logger.service.ts`, this global service provides structured logging methods for all security events.

**Key Features:**
- Daily log rotation (90-day retention)
- Structured JSON format
- Non-blocking async I/O
- Request context extraction (IP, User-Agent)
- Severity levels (info, warning, critical)
- PII-compliant (no passwords logged)

### Log Storage

**File-based (Default):**
- Location: `logs/audit-YYYY-MM-DD.log`
- Rotation: Daily at midnight
- Retention: 90 days
- Max file size: 20MB

**Database (Optional):**
- Table: `audit_logs`
- Fields: id, eventType, userId, email, ip, userAgent, severity, metadata, createdAt
- Indexes: userId, eventType, createdAt, severity
- Use case: Compliance reporting, security dashboards

## Logged Events

### Authentication Events

| Event Type | Severity | Trigger | Metadata |
|-----------|----------|---------|----------|
| `REGISTRATION` | info | New user registration | userId, email |
| `LOGIN_SUCCESS` | info | Successful login | userId, email |
| `LOGIN_FAILED` | warning | Failed login attempt | email (no userId if user doesn't exist) |
| `LOGOUT` | info | User logout | userId |
| `REFRESH_TOKEN_USED` | info | Token refresh | userId, email |

### Security Events

| Event Type | Severity | Trigger | Metadata |
|-----------|----------|---------|----------|
| `RATE_LIMIT_EXCEEDED` | warning | Rate limit violation | endpoint, userId (if authenticated) |
| `CSRF_VALIDATION_FAILED` | warning | Invalid CSRF token | method, url, userId (if available) |
| `UNAUTHORIZED_ACCESS` | warning | Access to protected resource without auth | endpoint, userId (if token provided but invalid) |

### Account Modification Events

| Event Type | Severity | Trigger | Metadata |
|-----------|----------|---------|----------|
| `PROFILE_UPDATED` | info | Profile data changed | updatedFields, hasSkills, hasExperiences, etc. |
| `PASSWORD_CHANGED` | info | Password updated | userId |
| `EMAIL_CHANGED` | info | Email address updated | oldEmail, newEmail |

### Future Events (Not Yet Implemented)

| Event Type | Severity | Use Case |
|-----------|----------|----------|
| `MULTIPLE_FAILED_LOGINS` | critical | 5+ failed logins in short period |
| `IP_CHANGE_DETECTED` | warning | Login from new location |

## Log Entry Structure

Every audit log entry contains:

```json
{
  "level": "info",
  "message": "LOGIN_SUCCESS",
  "eventType": "LOGIN_SUCCESS",
  "userId": "cm4akk1pz0000z8p3d5g8qj2m",
  "email": "user@example.com",
  "ip": "192.168.1.100",
  "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "timestamp": "2025-11-22T19:30:45.123Z",
  "severity": "info",
  "metadata": {
    "success": true
  }
}
```

**Required Fields:**
- `eventType`: Event identifier (enum value)
- `ip`: Client IP address
- `userAgent`: Client user agent string
- `timestamp`: ISO 8601 timestamp
- `severity`: Log severity (info, warning, critical)

**Optional Fields:**
- `userId`: User ID (if authenticated)
- `email`: User email
- `metadata`: Additional event-specific context

## Usage Examples

### Integration in Controllers

```typescript
import { AuditLoggerService } from '../common/audit-logger';

@Controller('auth')
export class AuthController {
  constructor(private auditLogger: AuditLoggerService) {}

  @Post('login')
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    try {
      const result = await this.authService.login(dto, req);
      return result;
    } catch (error) {
      // Login failure is already logged in AuthService
      throw error;
    }
  }
}
```

### Integration in Services

```typescript
import { AuditLoggerService } from '../common/audit-logger';

@Injectable()
export class AuthService {
  constructor(private auditLogger: AuditLoggerService) {}

  async login(dto: LoginDto, req: Request) {
    const user = await this.findUser(dto.email);
    
    if (!user) {
      // Log failed attempt
      this.auditLogger.logLoginAttempt(dto.email, false, req);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (await this.verifyPassword(user, dto.password)) {
      // Log successful login
      this.auditLogger.logLoginAttempt(dto.email, true, req, user.id);
      return this.generateTokens(user);
    }

    // Log failed attempt with user ID
    this.auditLogger.logLoginAttempt(dto.email, false, req, user.id);
    throw new UnauthorizedException('Invalid credentials');
  }
}
```

### Custom Event Logging

```typescript
// Log custom security event
this.auditLogger.log({
  eventType: AuditEventType.UNAUTHORIZED_ACCESS,
  userId: req.user?.id,
  ip: req.ip,
  userAgent: req.headers['user-agent'] || 'unknown',
  timestamp: new Date(),
  severity: 'warning',
  metadata: {
    endpoint: req.url,
    method: req.method,
  },
});
```

## Security & Compliance

### PII Handling

**Logged:**
- Email addresses (necessary for security tracking)
- IP addresses (necessary for threat detection)
- User IDs (internal identifiers)

**Never Logged:**
- Passwords (plain or hashed)
- Authentication tokens (JWT, refresh tokens)
- Credit card numbers
- Social security numbers
- Other sensitive PII

### GDPR Compliance

**Data Retention:**
- File logs: 90 days (configurable)
- Database logs: Can be set independently
- Anonymization: On user deletion, userId can be set to 'deleted' in historical logs

**Right to Access:**
- Users can request their audit logs via API (future feature)

**Right to Erasure:**
- Email/IP can be pseudonymized while preserving security value
- Audit trail integrity must be balanced with user rights

### ISO 27001 Compliance

Audit logging supports several ISO 27001 controls:
- **A.12.4.1**: Event logging (information security events)
- **A.12.4.3**: Administrator and operator logs
- **A.9.4.2**: Secure log-on procedures monitoring
- **A.18.1.3**: Protection of records (log retention)

## Configuration

### Environment Variables

```bash
# No specific env vars required - uses default configuration
# Log directory is created at `logs/` in project root
```

### Winston Configuration

Logs are configured in `AuditLoggerService` constructor:

```typescript
private logger = createLogger({
  format: format.combine(format.timestamp(), format.json()),
  transports: [
    new DailyRotateFile({
      filename: 'logs/audit-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '90d',
      level: 'info',
    }),
    // Console output in development
    ...(process.env.NODE_ENV === 'development' ? [
      new transports.Console({
        format: format.combine(format.colorize(), format.simple()),
      }),
    ] : []),
  ],
});
```

## Testing

E2E tests validate all audit logging functionality:

```bash
npm run test:e2e -- audit-logging.e2e-spec.ts
```

**Test Coverage:**
- Authentication events (register, login, logout, refresh)
- Failed login attempts
- Rate limit violations
- Profile updates
- IP address extraction
- PII compliance (passwords not logged)
- Log entry structure validation

## Monitoring & Alerting

### Future Enhancements

**Real-time Alerting:**
- Email notifications for critical events
- Slack/Teams webhooks for suspicious activity
- PagerDuty integration for security incidents

**SIEM Integration:**
- Forward logs to Splunk, ELK, or Azure Sentinel
- Correlation with other security events
- Automated threat detection

**Anomaly Detection:**
- Multiple failed logins from same IP
- Login from unusual location
- Rapid succession of requests
- Account modifications outside business hours

**Admin Dashboard:**
- View recent security events
- Filter by user, event type, severity
- Export logs for compliance audits
- Generate security reports

## Performance Considerations

**Async I/O:**
- Winston uses non-blocking file writes
- Logging doesn't impact API response times
- Queued writes prevent bottlenecks

**Log Rotation:**
- Daily rotation prevents large files
- Old logs automatically archived/compressed
- Configurable retention policy

**Storage:**
- 90 days of logs ~50-200MB (typical workload)
- Compress old logs for archival
- Consider Azure Blob Storage for long-term retention

## Troubleshooting

### Logs Not Being Created

**Issue:** No log files in `logs/` directory

**Solutions:**
1. Check file permissions: `mkdir -p logs && chmod 755 logs`
2. Verify winston is installed: `npm list winston`
3. Check for initialization errors in console

### Missing Events

**Issue:** Expected events not appearing in logs

**Solutions:**
1. Verify AuditLoggerService is injected in module
2. Check that Request object is passed to service methods
3. Confirm event is triggered (add debug logging)

### High Log Volume

**Issue:** Log files growing too large

**Solutions:**
1. Reduce `maxSize` in DailyRotateFile config
2. Decrease retention period (`maxFiles`)
3. Implement sampling for high-frequency events
4. Move to external log aggregation service

## Migration Notes

### From No Logging

1. Install dependencies: `npm install winston winston-daily-rotate-file`
2. Import AuditLoggerModule in AppModule
3. Inject AuditLoggerService in services
4. Add logging calls to security-critical operations
5. Test with E2E suite

### Adding Database Persistence

1. Apply Prisma migration: `npm run prisma:migrate`
2. Update AuditLoggerService to write to DB
3. Implement log retention policy in database
4. Add indexes for query performance
5. Consider partitioning for large datasets

## References

- [Winston Documentation](https://github.com/winstonjs/winston)
- [winston-daily-rotate-file](https://github.com/winstonjs/winston-daily-rotate-file)
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
- [NIST SP 800-92: Guide to Computer Security Log Management](https://csrc.nist.gov/publications/detail/sp/800-92/final)
