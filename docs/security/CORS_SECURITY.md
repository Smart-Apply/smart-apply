# CORS Security Configuration

## Overview

The Smart Apply API implements a restrictive CORS (Cross-Origin Resource Sharing) policy to prevent unauthorized access from malicious domains. This document explains the configuration and how to manage it across different environments.

## Current Implementation

### Location

- **Configuration:** `apps/api/src/main.ts` (lines 25-34)
- **Environment Variable:** `CORS_ORIGINS` in `.env` or `.env.example`
- **Schema Validation:** `apps/api/src/config/env.schema.ts`

### CORS Settings

```typescript
app.enableCors({
  origin: configService.corsOrigins,      // Array of allowed origins
  credentials: true,                      // Allow cookies/auth headers
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],  // Allowed HTTP methods
  allowedHeaders: ['Content-Type', 'Authorization'],   // Allowed headers
});
```

## Environment Configuration

### Development (Local)

```bash
# .env
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
```

This allows:

- Backend API (port 3000)
- Frontend Dev Server (port 3001)

### Production (Azure)

```bash
# Environment Variables / Azure Key Vault
CORS_ORIGINS=https://smartapply.azurewebsites.net,https://www.smartapply.com
```

**Important:** Never use wildcard `*` or `origin: true` in production!

## Security Benefits

1. **Prevents CSRF Attacks:** Only trusted origins can make requests
2. **Blocks Data Leakage:** Unauthorized sites cannot read responses
3. **Restricts HTTP Methods:** Only necessary methods are allowed
4. **Controls Headers:** Limits which headers can be sent

## Testing CORS Configuration

### Manual Testing with cURL

#### Test Allowed Origin

```bash
curl -X OPTIONS http://localhost:3000/api/v1/auth/me \
  -H "Origin: http://localhost:3001" \
  -H "Access-Control-Request-Method: GET" \
  -v
```

Expected response headers:

```text
Access-Control-Allow-Origin: http://localhost:3001
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET,POST,PUT,DELETE,PATCH
Access-Control-Allow-Headers: Content-Type,Authorization
```

#### Test Blocked Origin

```bash
curl -X OPTIONS http://localhost:3000/api/v1/auth/me \
  -H "Origin: https://malicious-site.com" \
  -H "Access-Control-Request-Method: GET" \
  -v
```

Expected: No `Access-Control-Allow-Origin` header in response (or different origin).

### Browser Testing

1. Open browser DevTools (F12)
2. Go to Network tab
3. Make a request to the API from your frontend
4. Check Response Headers for `Access-Control-*` headers

### Automated Testing

Run the E2E CORS test suite:

```bash
cd apps/api
npm run test:e2e -- cors.e2e-spec.ts
```

## Deployment Checklist

Before deploying to production:

- [ ] Set `CORS_ORIGINS` to production frontend URLs
- [ ] Ensure no `localhost` or `127.0.0.1` in production origins
- [ ] Verify all origins use HTTPS (not HTTP)
- [ ] Test CORS headers in staging environment
- [ ] Update Azure Key Vault / Container Apps secrets
- [ ] Document all allowed origins in deployment docs

## Common Issues

### Issue: "CORS error: Origin not allowed"

**Cause:** Frontend origin is not in `CORS_ORIGINS` list.

**Solution:** Add the origin to `CORS_ORIGINS` environment variable:

```bash
CORS_ORIGINS=http://localhost:3001,https://my-frontend.com
```

### Issue: "Credentials flag is true, but Access-Control-Allow-Credentials is missing"

**Cause:** Browser requires credentials but CORS not configured properly.

**Solution:** Ensure `credentials: true` in CORS config (already set).

### Issue: "Method PUT is not allowed by CORS"

**Cause:** HTTP method not in allowed methods list.

**Solution:** Add the method to `methods` array in `main.ts` (already includes PUT).

## Advanced Configuration

### Adding Custom Headers

If you need to allow additional headers:

```typescript
app.enableCors({
  origin: configService.corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Custom-Header'],  // Add here
});
```

### Dynamic Origin Validation

For more complex validation (e.g., wildcard subdomains):

```typescript
app.enableCors({
  origin: (origin, callback) => {
    const allowedOrigins = configService.corsOrigins;
    const allowedPatterns = [/\.smartapply\.com$/];  // Allow all *.smartapply.com

    if (!origin || allowedOrigins.includes(origin) ||
        allowedPatterns.some(pattern => pattern.test(origin))) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});
```

## References

- [MDN: CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [NestJS CORS](https://docs.nestjs.com/security/cors)
- [OWASP: CORS](https://owasp.org/www-community/attacks/CORS_OriginHeaderScrutiny)

## Audit History

| Date       | Change                                    | Author  |
| ---------- | ----------------------------------------- | ------- |
| 2025-11-15 | Initial restrictive CORS implementation   | Copilot |
| 2025-11-15 | Added explicit methods and headers        | Copilot |
| 2025-11-15 | Documented production origin requirements | Copilot |
