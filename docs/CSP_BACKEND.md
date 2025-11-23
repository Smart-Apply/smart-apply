# Backend Content Security Policy (CSP) Configuration

## Overview

Content Security Policy (CSP) is a critical security layer that helps prevent Cross-Site Scripting (XSS), clickjacking, and other code injection attacks. This document details the **backend** CSP implementation in Smart Apply.

> **Note:** The backend CSP complements the [frontend CSP configuration](../apps/web/next.config.ts). Together, they provide defense-in-depth protection.

## Architecture

### Defense-in-Depth Strategy

Smart Apply implements **three layers** of XSS protection:

1. **Layer 1: Input Sanitization** - `@Sanitize()` decorator on all user inputs
2. **Layer 2: Output Encoding** - React's automatic escaping + template engines
3. **Layer 3: CSP Headers** - Browser-level protection (this document)

The CSP layer acts as a **fallback** if sanitization or encoding fails, preventing malicious scripts from executing even if they reach the browser.

## Implementation

### Configuration Location

**File:** `apps/api/src/main.ts`

The CSP is configured via Helmet middleware during application bootstrap:

```typescript
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: configService.isDevelopment
          ? ["'self'", "'unsafe-inline'", "'unsafe-eval'"]
          : ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: configService.isProduction ? [] : null,
        reportUri: ['/api/v1/csp-violations'],
      },
      reportOnly: configService.cspReportOnly,
    },
    // ... other Helmet options
  }),
);
```

## CSP Directives Explained

### Core Directives

| Directive | Value | Purpose | Security Impact |
|-----------|-------|---------|-----------------|
| `default-src` | `'self'` | Default policy for all resource types | High - Blocks all external resources by default |
| `script-src` | `'self'` (prod)<br/>`'self' 'unsafe-inline' 'unsafe-eval'` (dev) | Controls JavaScript execution | **Critical** - Prevents inline script injection<br/>Dev: Allows Swagger UI |
| `style-src` | `'self' 'unsafe-inline'` | Controls CSS loading | Medium - Inline styles needed for Swagger UI |
| `img-src` | `'self' data: https:` | Controls image sources | Low - Allows data URIs and HTTPS images |
| `connect-src` | `'self'` | Controls AJAX/WebSocket connections | High - Prevents data exfiltration to external domains |
| `font-src` | `'self' data:` | Controls font loading | Low - Allows data URI fonts |
| `object-src` | `'none'` | Disallows plugins (Flash, Java) | High - Prevents plugin-based attacks |
| `media-src` | `'self'` | Controls audio/video sources | Medium - Restricts media to same origin |
| `frame-src` | `'none'` | Disallows iframes | Medium - Prevents iframe-based attacks |
| `frame-ancestors` | `'none'` | Prevents embedding in iframes | **High** - Clickjacking protection |
| `base-uri` | `'self'` | Restricts `<base>` tag | Medium - Prevents base tag injection |
| `form-action` | `'self'` | Restricts form submission targets | Medium - Prevents form hijacking |
| `upgrade-insecure-requests` | `[]` (prod)<br/>`null` (dev) | Forces HTTPS upgrades | High - Ensures encrypted connections |
| `report-uri` | `/api/v1/csp-violations` | Violation reporting endpoint | N/A - Monitoring only |

### Environment-Specific Behavior

#### Development Mode
- **Allows** `unsafe-inline` and `unsafe-eval` in `script-src`
- **Reason:** Swagger UI requires these for documentation interface
- **Risk Mitigation:** Development is not exposed to internet

#### Production Mode
- **Strict** CSP without `unsafe-*` directives
- **Enforces** HTTPS with `upgrade-insecure-requests`
- **Recommended:** Start with `CSP_REPORT_ONLY=true` for testing

## Environment Variables

### CSP_REPORT_ONLY

**Purpose:** Control whether CSP violations are logged or enforced.

**Values:**
- `false` (default) - **Enforcing mode** - Violations are blocked
- `true` - **Report-only mode** - Violations are logged but not blocked

**Usage:**
```bash
# .env file
CSP_REPORT_ONLY=false  # Enforcing (production)
CSP_REPORT_ONLY=true   # Report-only (testing)
```

**Recommendation:**
1. Start with `CSP_REPORT_ONLY=true` when deploying new CSP configuration
2. Monitor logs for violations for 1-2 weeks
3. Fix any legitimate violations in code
4. Switch to `CSP_REPORT_ONLY=false` to enforce

## CSP Violation Reporting

### Endpoint

**URL:** `POST /api/v1/csp-violations`  
**Authentication:** Public (no auth required)  
**Rate Limit:** 100 requests/15 minutes (default limit)

### Implementation

**File:** `apps/api/src/common/csp/csp-violation.controller.ts`

```typescript
@Controller('csp-violations')
export class CSPViolationController {
  @Post()
  @HttpCode(204)
  @Public()
  async reportViolation(@Body() violation: CSPViolation) {
    const report = violation['csp-report'];
    
    this.logger.warn('CSP Violation detected', {
      directive: report['violated-directive'],
      blockedUri: report['blocked-uri'],
      documentUri: report['document-uri'],
      sourceFile: report['source-file'],
      // ...
    });
    
    // Optional: Store in database for analysis
    // await this.prisma.cspViolation.create({ ... });
  }
}
```

### Violation Report Structure

Browsers send violation reports in this format:

```json
{
  "csp-report": {
    "document-uri": "https://example.com/page",
    "referrer": "",
    "violated-directive": "script-src 'self'",
    "effective-directive": "script-src",
    "original-policy": "default-src 'self'; script-src 'self'",
    "disposition": "enforce",
    "blocked-uri": "https://evil.com/script.js",
    "line-number": 42,
    "column-number": 10,
    "source-file": "https://example.com/app.js",
    "status-code": 200,
    "script-sample": ""
  }
}
```

### Monitoring Violations

**View Real-Time Logs:**
```bash
# Tail application logs
tail -f logs/nest-*.log | grep "CSP Violation"

# Or use NestJS default logging
npm run start:dev
# Look for [CSPViolationController] warnings
```

**Common Violations to Watch For:**

1. **Inline Scripts** - `violated-directive: script-src`
   - Fix: Move inline scripts to external files or use nonces
   
2. **External Resources** - `violated-directive: img-src` or `connect-src`
   - Fix: Add domain to whitelist or host resources locally
   
3. **Frame Embedding** - `violated-directive: frame-ancestors`
   - Fix: Verify this is malicious (expected if preventing clickjacking)

## Testing

### Manual Testing

#### 1. Check CSP Header is Present

```bash
# Check response headers
curl -I http://localhost:3000/api/v1/auth/me

# Look for one of these headers:
# Content-Security-Policy: default-src 'self'; ...
# Content-Security-Policy-Report-Only: default-src 'self'; ...
```

#### 2. Test Report-Only Mode

```bash
# Set environment variable
export CSP_REPORT_ONLY=true

# Start server
npm run start:dev

# Make request and check header
curl -I http://localhost:3000/api/v1/auth/me | grep "Content-Security-Policy-Report-Only"
```

#### 3. Test Violation Reporting

```bash
# Send test violation report
curl -X POST http://localhost:3000/api/v1/csp-violations \
  -H "Content-Type: application/json" \
  -d '{
    "csp-report": {
      "document-uri": "https://example.com/test",
      "violated-directive": "script-src",
      "blocked-uri": "https://evil.com/script.js",
      "effective-directive": "script-src",
      "original-policy": "default-src '\''self'\''",
      "disposition": "enforce"
    }
  }'

# Check server logs for violation
# Expected: [CSPViolationController] CSP Violation detected ...
```

### Automated Testing

**E2E Test Suite:** `apps/api/test/csp-headers.e2e-spec.ts`

**Run Tests:**
```bash
npm run test:e2e -- csp-headers
```

**Coverage:**
- ✅ CSP header presence (enforcing or report-only)
- ✅ Strict directives (`default-src`, `object-src`, `frame-ancestors`)
- ✅ Environment-specific `script-src` (dev vs prod)
- ✅ Security headers (X-Frame-Options, X-Content-Type-Options, etc.)
- ✅ Violation reporting endpoint (public access)
- ✅ Report-only mode switching
- ✅ Defense-in-depth validation (multiple XSS protection layers)

**Test Results:**
```
Test Suites: 1 passed, 1 total
Tests:       17 passed, 17 total
```

## Browser Compatibility

CSP is supported by all modern browsers:

| Browser | Support | Notes |
|---------|---------|-------|
| Chrome | ✅ Full | Level 3 |
| Firefox | ✅ Full | Level 3 |
| Safari | ✅ Full | Level 3 |
| Edge | ✅ Full | Level 3 |
| IE 11 | ⚠️ Partial | Level 1 only (deprecated) |

**Note:** CSP violations are reported only by browsers that support the `report-uri` directive.

## Common Issues & Solutions

### Issue: Swagger UI Broken in Development

**Symptom:** Swagger UI at `/docs` displays blank page or console errors

**Cause:** Strict CSP blocks inline scripts required by Swagger

**Solution:** Development mode automatically allows `unsafe-inline` and `unsafe-eval`

```typescript
scriptSrc: configService.isDevelopment
  ? ["'self'", "'unsafe-inline'", "'unsafe-eval'"]  // Dev: Allow Swagger
  : ["'self'"],  // Prod: Strict
```

**Verification:**
```bash
# Ensure NODE_ENV is set to development
echo $NODE_ENV  # Should output: development

# Visit Swagger UI
open http://localhost:3000/docs
```

### Issue: High Volume of Violation Reports

**Symptom:** Excessive log entries or POST requests to `/csp-violations`

**Cause:** Legitimate violations from code or malicious traffic

**Solutions:**

1. **Rate Limiting** (already implemented):
   ```typescript
   // Default rate limit applies to /csp-violations
   // 100 requests per 15 minutes per IP
   ```

2. **Identify Violation Source:**
   ```bash
   # Analyze logs for patterns
   grep "CSP Violation" logs/nest-*.log | \
     jq '.blockedUri' | \
     sort | uniq -c | sort -rn
   ```

3. **Fix Legitimate Violations:**
   - Update CSP directives to whitelist required resources
   - Remove inline scripts/styles from code
   - Host external resources locally

4. **Block Malicious Reports:**
   - Consider adding authentication to CSP violation endpoint
   - Use Web Application Firewall (WAF) to filter fake reports

### Issue: Production Deployment Errors

**Symptom:** 500 errors or CSP-related crashes in production

**Cause:** Missing `CSP_REPORT_ONLY` environment variable

**Solution:** Explicitly set in production environment:

```bash
# Azure Container Apps
az containerapp update \
  --name smartapply-api \
  --resource-group $RESOURCE_GROUP \
  --set-env-vars "CSP_REPORT_ONLY=false"

# Or via Key Vault reference
az keyvault secret set \
  --vault-name $KEY_VAULT_NAME \
  --name "csp-report-only" \
  --value "false"
```

## Production Deployment

### Pre-Deployment Checklist

- [ ] Set `CSP_REPORT_ONLY=true` initially
- [ ] Deploy to staging environment
- [ ] Monitor violation logs for 1-2 weeks
- [ ] Fix any legitimate violations
- [ ] Test all user flows (login, uploads, forms)
- [ ] Verify Swagger UI works in development environment
- [ ] Update CSP directives if needed
- [ ] Set `CSP_REPORT_ONLY=false` to enforce
- [ ] Deploy to production
- [ ] Monitor for errors in production logs

### Recommended Rollout Strategy

**Phase 1: Report-Only (Week 1-2)**
```bash
CSP_REPORT_ONLY=true
```
- No user impact (violations logged, not blocked)
- Collect violation data
- Identify false positives

**Phase 2: Gradual Enforcement (Week 3-4)**
```bash
CSP_REPORT_ONLY=false
```
- Enable enforcement in staging
- Test critical user flows
- Monitor for breakage

**Phase 3: Production Enforcement (Week 5+)**
```bash
CSP_REPORT_ONLY=false
```
- Roll out to production
- Monitor closely for first 48 hours
- Be ready to rollback if issues arise

### Rollback Procedure

If CSP causes production issues:

```bash
# Quick rollback: Switch to report-only mode
az containerapp update \
  --name smartapply-api \
  --resource-group $RESOURCE_GROUP \
  --set-env-vars "CSP_REPORT_ONLY=true"

# Or disable CSP temporarily (not recommended)
# Requires code change to disable Helmet CSP
```

## Security Considerations

### Defense-in-Depth

CSP is **NOT** a replacement for:
- Input sanitization (`@Sanitize()` decorator)
- Output encoding (React escaping)
- Authentication (JWT tokens)
- Rate limiting (throttler)
- CORS configuration

CSP is a **fallback** layer that prevents exploitation if other layers fail.

### Known Limitations

1. **Browser Support Required** - CSP only works in browsers that support it
2. **Not 100% Effective** - Advanced attackers may find bypasses
3. **Maintenance Overhead** - Requires ongoing monitoring and updates
4. **Development Friction** - May require relaxed policy in dev mode

### Best Practices

✅ **Do:**
- Start with report-only mode
- Monitor violations regularly
- Keep CSP directives as strict as possible
- Use nonces for inline scripts (future enhancement)
- Document all CSP changes

❌ **Don't:**
- Use `unsafe-inline` or `unsafe-eval` in production
- Whitelist entire domains (`*.example.com`)
- Ignore violation reports
- Disable CSP in production to "fix" issues

## Future Enhancements

### Nonce-Based CSP (Post-MVP)

**Goal:** Replace `unsafe-inline` with cryptographic nonces

**Benefits:**
- Strict CSP in production
- No inline script restrictions
- Better security posture

**Implementation:**
```typescript
// Generate nonce per request
const nonce = crypto.randomBytes(16).toString('base64');
res.locals.cspNonce = nonce;

// Inject into CSP header
scriptSrc: [`'self'`, `'nonce-${nonce}'`]

// Use in templates
<script nonce="${nonce}">...</script>
```

### CSP Violation Dashboard

**Goal:** Web UI for viewing violation reports

**Features:**
- Real-time violation stream
- Filtering by directive, blocked URI
- Trending analysis
- Export to CSV/JSON

### Subresource Integrity (SRI)

**Goal:** Verify integrity of external resources

**Implementation:**
```html
<script src="https://cdn.example.com/lib.js"
  integrity="sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8wC"
  crossorigin="anonymous"></script>
```

## References

- [MDN: Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [OWASP: Content Security Policy Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html)
- [CSP Evaluator by Google](https://csp-evaluator.withgoogle.com/)
- [Helmet Documentation](https://helmetjs.github.io/)
- [W3C CSP Level 3 Specification](https://www.w3.org/TR/CSP3/)

---

**Last Updated:** 2025-11-23  
**Maintained By:** Security Team  
**Review Frequency:** Quarterly or after security incidents
