# Security Guidelines

This document outlines security best practices and procedures for the Smart Apply application.

## 🔐 JWT Secret Management

### Production Requirements

The JWT secret is **CRITICAL** for authentication security. A compromised secret allows attackers to forge authentication tokens and impersonate any user.

#### Requirements
- **Minimum Length:** 64 characters (base64-encoded)
- **Entropy:** Cryptographically secure random generation
- **Storage:** Azure Key Vault (never in code or version control)
- **Rotation:** Every 90 days or immediately if compromised

### Generating a Secure JWT Secret

#### For Development/Local Testing
```bash
# Generate a strong 64+ character secret
openssl rand -base64 64

# Copy output to your .env file
# Example output: sXeS4t0WUUSGWSNF39j81hVFFpaCX3xgWco3a2Sb+ClEvHlcmxd//0IUlLdAAxza3cNkxoci8UuFtyVxeLONkg==
```

#### For Production (Azure Key Vault)
```bash
# 1. Generate the secret
JWT_SECRET=$(openssl rand -base64 64)

# 2. Store in Azure Key Vault
az keyvault secret set \
  --vault-name $KEY_VAULT_NAME \
  --name "jwt-secret" \
  --value "$JWT_SECRET"

# 3. Configure Container Apps to reference Key Vault
az containerapp update \
  --name smartapply-api \
  --resource-group $RESOURCE_GROUP \
  --set-env-vars "JWT_SECRET=secretref:jwt-secret"

# 4. Add Key Vault reference in Container Apps secrets
az containerapp secret set \
  --name smartapply-api \
  --resource-group $RESOURCE_GROUP \
  --secrets "jwt-secret=keyvaultref:https://$KEY_VAULT_NAME.vault.azure.net/secrets/jwt-secret,identityref:system"
```

### Secret Rotation Procedure

Regular rotation of the JWT secret is a security best practice. Follow this procedure to rotate without downtime:

#### Step 1: Generate New Secret
```bash
NEW_JWT_SECRET=$(openssl rand -base64 64)
```

#### Step 2: Update Azure Key Vault
```bash
# Store new secret with version
az keyvault secret set \
  --vault-name $KEY_VAULT_NAME \
  --name "jwt-secret" \
  --value "$NEW_JWT_SECRET"
```

#### Step 3: Rolling Update Strategy

**Option A: Immediate Rotation (Forces Re-authentication)**
```bash
# Update Container Apps environment variable
az containerapp update \
  --name smartapply-api \
  --resource-group $RESOURCE_GROUP \
  --set-env-vars "JWT_SECRET=secretref:jwt-secret"

# Restart to pick up new secret
az containerapp revision restart \
  --name smartapply-api \
  --resource-group $RESOURCE_GROUP
```

**Note:** This approach invalidates all existing tokens. Users will need to log in again.

**Option B: Graceful Rotation (Dual-Key Validation - Future Enhancement)**

For production systems with many active users, implement dual-key validation:
1. Accept tokens signed with either old or new secret (grace period)
2. Issue new tokens with new secret only
3. After grace period (e.g., 24 hours), remove old secret

*This feature is not currently implemented but recommended for post-MVP.*

#### Step 4: Verify Rotation
```bash
# Test authentication with new deployment
curl -X POST https://api.smartapply.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass"}'

# Verify token is valid
TOKEN="<token-from-response>"
curl -H "Authorization: Bearer $TOKEN" \
  https://api.smartapply.com/api/v1/auth/me
```

#### Step 5: Document Rotation
```bash
# Add rotation record to Key Vault tags
az keyvault secret set-attributes \
  --vault-name $KEY_VAULT_NAME \
  --name "jwt-secret" \
  --tags "rotated-date=$(date -u +%Y-%m-%d)" "rotated-by=$USER"
```

### Rotation Schedule

| Environment | Frequency | Method |
|-------------|-----------|--------|
| Development | As needed | Manual `.env` update |
| Staging | Every 90 days | Azure Key Vault rotation |
| Production | Every 90 days or on compromise | Azure Key Vault rotation with audit trail |

### Security Validation

The application automatically validates JWT secret requirements at startup:

```typescript
// Enforced in apps/api/src/config/env.schema.ts
JWT_SECRET: z
  .string()
  .min(64, 'JWT_SECRET must be at least 64 characters')
  .refine(
    (val) => !val.includes('change') && !val.includes('REPLACE'),
    'JWT_SECRET cannot contain placeholder text'
  )
```

If validation fails, the application will **not start** and display a clear error message.

## 🔄 Refresh Token Strategy

### Overview

Smart Apply uses a dual-token authentication strategy for enhanced security:

- **Access Token**: Short-lived (15 minutes), used for API authentication
- **Refresh Token**: Long-lived (30 days), used to obtain new access tokens

Both tokens are stored in HttpOnly cookies to prevent XSS attacks.

### Security Features

1. **Token Rotation**: Each refresh operation invalidates the old refresh token and issues a new one
2. **Device Tracking**: Store user agent and IP address for audit trail
3. **Max Tokens Per User**: Limit of 5 active refresh tokens per user (oldest automatically revoked)
4. **Token Hashing**: Refresh tokens are hashed with argon2 before storage
5. **Automatic Cleanup**: Expired and revoked tokens are deleted during refresh
6. **Type Validation**: Access tokens cannot be used as refresh tokens

### Configuration

```bash
# Environment variables
JWT_ACCESS_EXPIRES_IN=15m   # Short-lived access tokens
JWT_REFRESH_EXPIRES_IN=30d  # Long-lived refresh tokens
```

### Token Lifecycle

```
Login/Register → Generate Token Pair → Store Refresh Token (hashed)
                      ↓
              Set HttpOnly Cookies
                      ↓
         API Requests (Access Token)
                      ↓
         Access Token Expires (15m)
                      ↓
    Auto-Refresh (Frontend interceptor)
                      ↓
         POST /auth/refresh (Refresh Token)
                      ↓
    Validate → Revoke Old → Generate New Pair
                      ↓
              Set New Cookies
                      ↓
         Retry Original Request
```

### Logout Behavior

When a user logs out:
1. All refresh tokens for the user are revoked in database
2. Both access and refresh cookies are cleared
3. User must re-authenticate to get new tokens

### Security Benefits

- **Reduced Attack Window**: Stolen access tokens expire in 15 minutes
- **Compromise Detection**: Token rotation makes refresh token reuse detectable
- **XSS Protection**: HttpOnly cookies prevent JavaScript access
- **Session Management**: Track and revoke sessions per device

For detailed implementation, see [REFRESH_TOKENS.md](./REFRESH_TOKENS.md).

## 🚨 Security Incident Response

### If JWT Secret is Compromised

**Immediate Actions:**
1. Rotate secret immediately using procedure above
2. Invalidate all active sessions/tokens (revoke all refresh tokens)
3. Monitor authentication logs for suspicious activity
4. Notify affected users if personal data may be exposed
5. Document incident in security log

**Investigation:**
1. Determine how secret was exposed
2. Review access logs (Key Vault, Container Apps)
3. Check for unauthorized token usage
4. Assess data exposure scope

**Prevention:**
1. Review and restrict Key Vault access policies
2. Enable Azure Key Vault audit logging
3. Implement secret scanning in CI/CD (GitHub Secret Scanning)
4. Consider enabling Azure Defender for Key Vault

## 🔒 Additional Security Best Practices

### Environment Variables
- **Never commit secrets** to version control (`.env` is in `.gitignore`)
- **Never log secrets** (sanitize logs of sensitive data)
- **Use Key Vault references** in production (not direct values)
- **Audit Key Vault access** regularly

### Authentication
- ✅ **HttpOnly cookies** for JWT token storage (prevents XSS, implemented)
- ✅ **CSRF protection** available (csrf-csrf package, optional with `ENABLE_CSRF=true`)
  - **Exception:** `/auth/refresh` endpoint is excluded from CSRF validation
  - Reason: Refresh endpoint is already protected by HttpOnly refresh_token cookie
  - Prevents chicken-and-egg problem: User can't get CSRF token without valid access token
- ✅ **Rate limiting** on authentication endpoints (5 attempts/15min, strict)
- ✅ **Strong password policies** enforced (8+ chars, mixed case, numbers, symbols)
- Consider **2FA** for high-value accounts (post-MVP)

### Input Sanitization (XSS Protection)
- ✅ **Backend sanitization** implemented on all user inputs (see [XSS_PROTECTION.md](./XSS_PROTECTION.md))
- All string fields in DTOs use `@Sanitize()` decorator
- HTML special characters escaped: `<`, `>`, `"`, `'`, `/`, `&`
- ✅ **Frontend validation** for URLs (http/https only)
- Rich text sanitization with DOMPurify (whitelist approach)
- Defense-in-depth: Backend + Frontend + React's built-in escaping

### CORS & Headers

#### Backend (NestJS API)
- ✅ **CORS origins restricted** to specified domains (see [CORS_SECURITY.md](./CORS_SECURITY.md))
- Configuration: `CORS_ORIGINS` environment variable with comma-separated list
- Allowed methods: GET, POST, PUT, DELETE, PATCH
- Allowed headers: Content-Type, Authorization, X-CSRF-Token
- ✅ **Content Security Policy (CSP)** - Backend layer of defense-in-depth XSS protection
  - `default-src 'self'` - Only allow same-origin resources
  - `script-src` - Development allows `unsafe-inline` and `unsafe-eval` for Swagger UI
  - `object-src 'none'` - Disallow plugins (Flash, Java, etc.)
  - `frame-ancestors 'none'` - Prevent iframe embedding (clickjacking)
  - `form-action 'self'` - Restrict form submissions
  - `upgrade-insecure-requests` - Force HTTPS in production
  - `report-uri /api/v1/csp-violations` - Violation reporting endpoint
  - Configuration: `CSP_REPORT_ONLY` environment variable (true=log, false=enforce)
- ✅ **Security headers** via Helmet middleware (X-Frame-Options, X-Content-Type-Options, etc.)
- Use **HTTPS** only in production (enforce via headers)

**Backend CSP Configuration:**
```typescript
// apps/api/src/main.ts
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: isDevelopment ? ["'self'", "'unsafe-inline'", "'unsafe-eval'"] : ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", 'data:'],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: isProduction ? [] : null,
      reportUri: ['/api/v1/csp-violations'],
    },
    reportOnly: configService.cspReportOnly, // Environment variable: CSP_REPORT_ONLY
  },
  // ... other Helmet options
}));
```

**Environment Variables:**
```bash
# CSP Report-Only Mode (for testing)
# true = Log violations without blocking (recommended for initial deployment)
# false = Enforce CSP and block violations (recommended for production after testing)
CSP_REPORT_ONLY=false
```

**CSP Violation Reporting:**
- Endpoint: `POST /api/v1/csp-violations` (public, no authentication)
- Violations are logged with structured data for monitoring
- Optional database storage for compliance reporting (commented out in MVP)

**Testing CSP:**
```bash
# Start server in report-only mode
CSP_REPORT_ONLY=true npm run start:dev

# Check response headers
curl -I http://localhost:3000/api/v1/auth/me

# Look for: Content-Security-Policy-Report-Only or Content-Security-Policy

# Test with intentional violation in browser console
# WARNING: Only run this in development/testing environments, never in production!
eval('alert("CSP Test")');  // Should be blocked by CSP

# Check server logs for violation reports
tail -f logs/nest-*.log | grep "CSP Violation"
```

**Production Checklist:**
- [ ] Set `CORS_ORIGINS` to production frontend URLs (no localhost)
- [ ] Verify all origins use HTTPS
- [ ] Test CORS preflight requests
- [ ] Document all allowed origins
- [ ] Start with `CSP_REPORT_ONLY=true` to test CSP without breaking functionality
- [ ] Monitor CSP violation logs for 1-2 weeks
- [ ] Fix any legitimate CSP violations in code
- [ ] Switch to `CSP_REPORT_ONLY=false` to enforce CSP in production
- [ ] Verify Swagger UI works (requires unsafe-inline/eval in development only)

#### Frontend (Next.js)
- ✅ **Content-Security-Policy (CSP)** - Controls which resources can be loaded
  - `default-src 'self'` - Only allow same-origin resources by default
  - `script-src` - Allows inline scripts for Next.js runtime (development includes `unsafe-eval` for HMR)
  - `style-src 'self' 'unsafe-inline'` - Required for Tailwind CSS and styled-components
  - `img-src 'self' data: https:` - Images from same origin, data URIs, and HTTPS sources
  - `connect-src` - Environment-aware API connections (localhost in dev, production URL in prod)
  - `frame-ancestors 'none'` - Prevent iframe embedding
  - `form-action 'self'` - Restrict form submissions to same origin
- ✅ **X-Frame-Options: DENY** - Additional clickjacking protection (defense in depth with CSP)
- ✅ **X-Content-Type-Options: nosniff** - Prevent MIME type sniffing attacks
- ✅ **Referrer-Policy: strict-origin-when-cross-origin** - Control referrer information leakage
- ✅ **Permissions-Policy** - Disable sensitive browser features (camera, microphone, geolocation)
- ✅ **Strict-Transport-Security (HSTS)** - Force HTTPS (production only, max-age=1 year)

**Configuration:**
```typescript
// apps/web/next.config.ts
async headers() {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
  
  // Environment-aware CSP
  // Development: Allows localhost + HMR WebSocket + unsafe-eval
  // Production: Strict CSP with production API URL
  
  return [{ source: '/:path*', headers: [...] }];
}
```

**Testing Security Headers:**
```bash
# Local development
npm run dev
curl -I http://localhost:3001

# Check CSP violations in browser DevTools Console
# Network tab: Verify response headers

# Online tools
# https://securityheaders.com/ - Overall security posture
# https://csp-evaluator.withgoogle.com/ - CSP-specific evaluation
```

**CSP Challenges with Next.js:**
- Next.js requires `unsafe-eval` in development for Hot Module Replacement (HMR)
- Inline styles from Tailwind CSS require `unsafe-inline` for `style-src`
- Production build removes `unsafe-eval` for enhanced security
- Consider using nonce-based CSP for stricter inline script control (post-MVP)

**Production Checklist:**
- [ ] Verify CSP headers are present in production deployment
- [ ] Test application functionality with strict CSP (no console errors)
- [ ] Confirm HSTS header is active (HTTPS only)
- [ ] Validate no CSP violations in browser DevTools
- [ ] Test iframe embedding is blocked (X-Frame-Options + frame-ancestors)

### Monitoring & Logging

✅ **Audit Logging Implemented** - Comprehensive security event tracking with winston

**Logged Events:**
- Authentication: LOGIN_SUCCESS, LOGIN_FAILED, LOGOUT, REGISTRATION, REFRESH_TOKEN_USED
- Security: RATE_LIMIT_EXCEEDED, CSRF_VALIDATION_FAILED, UNAUTHORIZED_ACCESS
- Account Changes: PROFILE_UPDATED, PASSWORD_CHANGED

**Features:**
- Structured JSON logs with daily rotation (90-day retention)
- Request context (IP, User-Agent) for threat analysis
- Severity levels (info, warning, critical)
- PII-compliant (no passwords logged)
- Optional database persistence for compliance reporting

**Log Location:** `logs/audit-YYYY-MM-DD.log`

For detailed documentation, see [AUDIT_LOGGING.md](./AUDIT_LOGGING.md)

**Future Enhancements:**
- Set up **alerts** for repeated failed logins (5+ attempts)
- Monitor **Key Vault access** for unauthorized attempts
- Enable **Azure Application Insights** for security telemetry
- SIEM integration (Splunk, ELK, Azure Sentinel)
- Real-time alerting (Email, Slack, PagerDuty)

## 📚 References

- [OWASP JWT Security Best Practices](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html)
- [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [OWASP Clickjacking Defense](https://cheatsheetseries.owasp.org/cheatsheets/Clickjacking_Defense_Cheat_Sheet.html)
- [Content Security Policy (CSP) Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [Security Headers Checker](https://securityheaders.com/)
- [CSP Evaluator](https://csp-evaluator.withgoogle.com/)
- [RFC 7519: JWT Specification](https://tools.ietf.org/html/rfc7519#section-11.2)
- [Azure Key Vault Best Practices](https://learn.microsoft.com/en-us/azure/key-vault/general/best-practices)
- [NIST Password Guidelines](https://pages.nist.gov/800-63-3/sp800-63b.html)

## 📝 Security Checklist for Production Deployment

Before deploying to production, verify:

- [ ] JWT secret is 64+ characters from `openssl rand -base64 64`
- [ ] Secret stored in Azure Key Vault (not in environment variables)
- [ ] Container Apps configured with Key Vault reference
- [ ] System-assigned Managed Identity enabled for Container Apps
- [ ] Key Vault access policy grants secret read to Managed Identity
- [ ] CORS origins restricted to production frontend domain
- [ ] HTTPS enforced (HTTP redirects disabled)
- [ ] Rate limiting enabled (especially on `/auth/*` endpoints)
- [ ] Input sanitization applied to all user inputs (backend & frontend)
- [ ] XSS protection tested with common attack vectors
- [ ] Backend security headers configured (Helmet middleware active)
- [ ] Backend CSP configured with report-only mode initially
- [ ] CSP violations monitored and fixed during testing period
- [ ] Backend CSP switched to enforcing mode after validation
- [ ] Frontend security headers configured (CSP, X-Frame-Options, HSTS)
- [ ] CSP violations tested (no errors in browser console)
- [ ] Application Insights enabled for monitoring
- [ ] Secret rotation procedure documented and tested
- [ ] Incident response plan in place
- [ ] Team trained on secret management procedures

---

**Last Updated:** 2025-11-22  
**Maintained By:** Security Team  
**Review Frequency:** Quarterly or after security incidents
