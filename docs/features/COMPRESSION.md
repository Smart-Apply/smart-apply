# Response Compression

## Overview

Smart Apply uses gzip compression middleware to reduce bandwidth usage for API responses. This feature provides significant performance improvements for large JSON responses (e.g., lists of applications, job postings) and reduces bandwidth costs.

## Features

- **Automatic Compression**: All responses larger than 1KB are automatically compressed
- **Gzip Algorithm**: Industry-standard compression (80%+ reduction typical)
- **Smart Filtering**: Only compresses when client supports it (via `Accept-Encoding` header)
- **Configurable**: Can be disabled via environment variable
- **Threshold-based**: Small responses (< 1KB) skip compression to avoid overhead

## Configuration

### Backend (NestJS)

Compression is enabled by default in the NestJS backend.

**Environment Variable:**
```bash
ENABLE_COMPRESSION=true  # Enable compression (default)
ENABLE_COMPRESSION=false # Disable compression
```

**Configuration:**
- **Threshold**: 1KB (1024 bytes) - responses smaller than this are not compressed
- **Level**: 6 (balance between speed and compression ratio, range: 0-9)
- **Filter**: Respects `Accept-Encoding` header from client
- **Exclusion**: Can disable per-request with `x-no-compression` header

### Frontend (Next.js)

Next.js compression is enabled by default in production builds.

**Configuration:**
```typescript
// apps/web/next.config.ts
const nextConfig: NextConfig = {
  compress: true, // Enable gzip compression
};
```

## Performance Impact

### Bandwidth Savings

Typical compression ratios for Smart Apply API responses:

| Endpoint | Uncompressed | Compressed (gzip) | Reduction |
|----------|--------------|-------------------|-----------|
| GET /applications (100 items) | 150 KB | 30 KB | 80% |
| GET /job-postings (50 items) | 75 KB | 15 KB | 80% |
| GET /profile (full) | 25 KB | 5 KB | 80% |
| GET /auth/me | 0.5 KB | 0.5 KB | 0% (below threshold) |

**Benefits:**
- Faster response times on slow networks (4G, 3G)
- Reduced bandwidth costs (especially important at scale)
- Better mobile experience
- Lower data usage for users

### CPU Impact

Compression adds minimal CPU overhead:
- **Small responses (< 1KB)**: No compression → 0% overhead
- **Medium responses (1-10 KB)**: ~2-5ms compression time
- **Large responses (> 100 KB)**: ~10-20ms compression time

The bandwidth savings far outweigh the CPU cost in most scenarios.

## How It Works

### Request Flow

1. **Client Request**: Browser sends `Accept-Encoding: gzip, deflate` header
2. **Middleware Check**: Compression middleware checks:
   - Is compression enabled globally? (`ENABLE_COMPRESSION`)
   - Does client support gzip? (`Accept-Encoding` header)
   - Is response size > threshold? (1KB)
   - Is compression disabled for this request? (`x-no-compression` header)
3. **Compression**: If all checks pass, response is compressed with gzip
4. **Response**: Server sends `Content-Encoding: gzip` header + compressed payload
5. **Client Decode**: Browser automatically decompresses the response

### Example

**Without Compression:**
```http
GET /api/v1/applications HTTP/1.1
Host: api.smartapply.com

HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 150000

[{"id":"1","title":"Software Engineer",...},{...}]  // 150 KB JSON
```

**With Compression:**
```http
GET /api/v1/applications HTTP/1.1
Host: api.smartapply.com
Accept-Encoding: gzip

HTTP/1.1 200 OK
Content-Type: application/json
Content-Encoding: gzip
Content-Length: 30000

<binary gzip data>  // 30 KB compressed (80% reduction)
```

## Testing Compression

### Manual Testing with curl

**Test if compression is working:**
```bash
# Request with gzip support
curl -H "Accept-Encoding: gzip" -I http://localhost:3000/api/v1/applications

# Should see:
# Content-Encoding: gzip
# Content-Length: <smaller size>

# Request without compression support
curl -I http://localhost:3000/api/v1/applications

# Should NOT see Content-Encoding header
```

**Test compression ratio:**
```bash
# Without compression
curl http://localhost:3000/api/v1/applications > uncompressed.json
ls -lh uncompressed.json  # Check size

# With compression (save binary output)
curl -H "Accept-Encoding: gzip" http://localhost:3000/api/v1/applications --compressed > compressed.json
ls -lh compressed.json  # Check size (should be 70-85% smaller)
```

### Automated Testing

Run the compression E2E tests:
```bash
cd apps/api
npm run test:e2e -- compression.e2e-spec.ts
```

**Test Coverage:**
- ✅ Compression headers for large responses
- ✅ No compression when `x-no-compression` header present
- ✅ No compression when `Accept-Encoding` missing
- ✅ Threshold behavior (< 1KB not compressed)
- ✅ Bandwidth reduction verification
- ✅ JSON content type compatibility
- ✅ Performance impact measurement

## Disabling Compression

### Per-Request

Add the `x-no-compression` header to disable compression for a specific request:
```typescript
// Frontend API client
fetch('/api/v1/applications', {
  headers: {
    'x-no-compression': '1',
  },
});
```

### Globally

Set the environment variable to disable compression for all requests:
```bash
# apps/api/.env
ENABLE_COMPRESSION=false
```

**When to disable:**
- Debugging compressed responses (harder to read in network inspector)
- Testing with tools that don't support gzip
- Benchmarking raw response sizes

## Browser Compatibility

All modern browsers support gzip compression by default:
- ✅ Chrome (all versions)
- ✅ Firefox (all versions)
- ✅ Safari (all versions)
- ✅ Edge (all versions)
- ✅ Mobile browsers (iOS, Android)

Browsers automatically:
1. Send `Accept-Encoding: gzip, deflate` header
2. Decompress gzip responses transparently
3. Pass decompressed JSON to JavaScript

No client-side code changes needed!

## Production Deployment

### Azure Container Apps

Compression is enabled at the application level (NestJS middleware). Azure Container Apps passes through the compressed responses without modification.

**Recommended Settings:**
```bash
# Production environment variables
ENABLE_COMPRESSION=true
```

### CDN Integration (Future)

If you add Azure CDN in front of the API:
- CDN can cache compressed responses
- Further reduces origin server load
- Improves global latency

**Note:** Compression happens at the NestJS layer, so CDN caching works seamlessly.

## Monitoring

### Logs

When compression is enabled, you'll see a log message on startup:
```
🗜️  Response compression enabled (gzip, level 6, threshold: 1KB)
```

When disabled:
```
⚠️  Response compression disabled (set ENABLE_COMPRESSION=true to enable)
```

### Metrics to Track

Monitor these metrics in production:
- **Bandwidth usage**: Should decrease 70-80% for API responses
- **Response times**: May improve for large responses on slow networks
- **CPU usage**: Should increase slightly (2-5%) but not significantly

## Troubleshooting

### Compression Not Working

**Check 1: Client sends Accept-Encoding header**
```bash
# Browser DevTools → Network → Request Headers
# Should see: Accept-Encoding: gzip, deflate
```

**Check 2: Response size > threshold**
```bash
# Small responses (< 1KB) won't be compressed
# Verify response size in DevTools
```

**Check 3: Compression enabled**
```bash
# Check logs on startup
# Should see: "Response compression enabled"
```

**Check 4: No x-no-compression header**
```bash
# Ensure request doesn't include x-no-compression header
```

### High CPU Usage

If compression causes high CPU usage:
1. Lower compression level: `level: 4` (faster, slightly larger)
2. Increase threshold: `threshold: 5120` (only compress > 5KB)
3. Disable for specific endpoints if needed

## Advanced: Brotli Compression

For even better compression (83% reduction vs 80% for gzip), consider Brotli:

```bash
npm install @nxtedition/brotli
```

```typescript
// main.ts
import * as brotli from '@nxtedition/brotli';

app.use(brotli.middleware({
  quality: 4, // 0-11 (4 is good balance)
  threshold: 1024,
}));
```

**Trade-offs:**
- ✅ Better compression (83% vs 80%)
- ✅ Better for static assets
- ❌ Slower compression (not ideal for dynamic JSON)
- ❌ Requires modern browsers (not IE11)

**Recommendation:** Stick with gzip for MVP. Consider Brotli post-launch for static assets only.

## References

- [compression npm package](https://www.npmjs.com/package/compression)
- [Next.js compress option](https://nextjs.org/docs/api-reference/next.config.js/compress)
- [MDN: Content-Encoding](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Encoding)
- [MDN: Accept-Encoding](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept-Encoding)
