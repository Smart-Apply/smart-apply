# Browser Pooling for PDF Generation

## Overview

Smart Apply uses browser pooling to prevent memory leaks and OOM crashes during PDF generation. Instead of creating a new browser instance for every PDF request, we maintain a pool of reusable browser instances.

## Implementation Details

### Technology

- **Library**: `generic-pool` v3.x
- **Resource**: Puppeteer Browser instances
- **Pattern**: Acquire → Use → Release

### Configuration

Browser pool behavior is controlled via environment variables:

```bash
# Maximum concurrent browser instances (default: 5)
PUPPETEER_MAX_BROWSERS=5

# Minimum browser instances to keep alive (default: 1)
PUPPETEER_MIN_BROWSERS=1

# Close idle browsers after N milliseconds (default: 30000 = 30s)
PUPPETEER_IDLE_TIMEOUT_MS=30000

# Check for idle browsers every N milliseconds (default: 10000 = 10s)
PUPPETEER_EVICTION_INTERVAL_MS=10000
```

### Pool Sizing Guidelines

**Formula**: `max_browsers = (cpu_cores × 2) + 1`

**Examples**:

- **Development** (2 cores): `PUPPETEER_MAX_BROWSERS=3`
- **Production** (4 cores): `PUPPETEER_MAX_BROWSERS=5`
- **High-traffic** (8 cores): `PUPPETEER_MAX_BROWSERS=9`

**Memory Considerations**:

- Each browser: ~50-100MB RAM
- Max pool size (5 browsers): ~500MB RAM
- Plan for: (max_browsers × 100MB) + 500MB overhead

### How It Works

1. **Initialization** (`onModuleInit`):
   - Creates browser pool with min/max size
   - Launches minimum browsers immediately
   - Configures idle timeout and eviction

2. **PDF Generation**:

   ```typescript
   // Acquire browser from pool
   const browser = await this.acquireBrowser();

   try {
     const page = await browser.newPage();
     // ... generate PDF ...
   } finally {
     // Always release browser back to pool
     await this.releaseBrowser(browser);
   }
   ```

3. **Cleanup** (`onModuleDestroy`):
   - Drains pool (waits for all borrowed browsers)
   - Closes all browsers
   - Clears pool resources

### Pool Metrics

Pool metrics are logged every 30 seconds in development mode:

```text
Pool Metrics: size=3, available=2, borrowed=1, pending=0,
utilization=33.3%, acquires=45, releases=44, errors=0
```

**Metrics explained**:

- `size`: Total browsers in pool
- `available`: Browsers ready for use
- `borrowed`: Browsers currently in use
- `pending`: Requests waiting for a browser
- `utilization`: Percentage of browsers in use
- `acquires`: Total acquire operations
- `releases`: Total release operations
- `errors`: Failed acquire/release operations

### Error Handling

**Pool Exhaustion**:

- If all browsers are busy, new requests wait up to 30 seconds
- After 30s timeout, throws: `Browser pool exhausted`
- Solution: Increase `PUPPETEER_MAX_BROWSERS`

**Browser Crashes**:

- Pool validates browsers before use (`isConnected()`)
- Invalid browsers are discarded and replaced
- No manual intervention needed

**Memory Leaks**:

- Idle browsers are closed after `PUPPETEER_IDLE_TIMEOUT_MS`
- Prevents memory accumulation during low traffic
- Browsers recreated on-demand when needed

## Testing

### Unit Tests

Unit tests mock the browser pool to verify logic without launching real browsers:

```bash
cd apps/api
npm run test:unit -- pdf.service.unit.spec
```

### Integration Tests

Integration tests use real Puppeteer browsers (requires Chromium):

```bash
cd apps/api
npm run test:integration -- browser-pool.integration.spec
```

**Note**: Integration tests will fail if Chromium is not installed.

### Load Testing

To verify pool behavior under load (100 concurrent requests):

```typescript
// Example load test
const promises = Array.from({ length: 100 }, () =>
  pdfService.generatePDF(html)
);

const results = await Promise.all(promises);
// All 100 PDFs should be generated successfully
```

## Monitoring

### Development

Pool metrics are logged to console every 30 seconds when `NODE_ENV=development`.

### Production

Monitor these metrics in Azure Application Insights:

1. **Pool Utilization**: Should stay < 80%
2. **Pending Requests**: Should stay at 0
3. **Error Count**: Should stay at 0
4. **Memory Usage**: Should remain constant

**Alert Thresholds**:

- Utilization > 80% for 5min → Increase max browsers
- Pending > 0 for 1min → Pool exhausted
- Errors > 10/hour → Browser stability issue
- Memory > 1GB/container → Pool size too large

## Troubleshooting

### High Utilization (>80%)

**Symptoms**: Pool frequently exhausted, requests queued

**Solutions**:

1. Increase `PUPPETEER_MAX_BROWSERS`
2. Scale horizontally (more containers)
3. Optimize PDF rendering (reduce complexity)

### Memory Leaks

**Symptoms**: Memory usage grows over time

**Solutions**:

1. Decrease `PUPPETEER_IDLE_TIMEOUT_MS` (close browsers faster)
2. Decrease `PUPPETEER_MIN_BROWSERS` (fewer idle browsers)
3. Check for unclosed pages in PDF generation code

### Browser Crashes

**Symptoms**: Errors > 0, PDF generation fails

**Solutions**:

1. Check Chromium logs for segfaults
2. Increase container memory limits
3. Reduce `PUPPETEER_MAX_BROWSERS` (less contention)
4. Update Puppeteer version

## Migration from Singleton

**Before** (Singleton browser):

```typescript
private browser: Browser | null = null;

async generatePDF() {
  const browser = await this.initializeBrowser();
  const page = await browser.newPage();
  // ... no release needed
}
```

**After** (Browser pool):

```typescript
private browserPool: Pool<Browser>;

async generatePDF() {
  const browser = await this.acquireBrowser();
  try {
    const page = await browser.newPage();
    // ... always release
  } finally {
    await this.releaseBrowser(browser);
  }
}
```

**Key Changes**:

1. Browser is acquired and released per request
2. Always use try-finally to ensure release
3. No manual browser creation (pool handles it)

## Performance Impact

**Before** (Singleton):

- Single browser, pages created per request
- No concurrency limit
- Memory grows linearly with concurrent requests
- OOM crash at ~100 concurrent requests

**After** (Browser pool):

- Configurable browser pool (default: 5)
- Natural concurrency limit (max browsers)
- Memory usage constant (pool size × 100MB)
- No OOM crashes (queue + timeout instead)

**Benchmark** (100 concurrent PDF requests):

- Singleton: 10GB RAM → OOM crash
- Pool (5 browsers): 500MB RAM → All succeed

## References

- [generic-pool Documentation](https://github.com/coopernurse/node-pool)
- [Puppeteer Best Practices](https://pptr.dev/)
- [Issue #199: Browser Pooling Implementation](https://github.com/Ar1anit/smart-apply/issues/199)
