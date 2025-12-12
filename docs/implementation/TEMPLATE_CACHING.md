# Template Caching Strategy

## Overview

The `TemplatesService` implements in-memory caching using `node-cache` to reduce database load and improve response times for template-related queries.

## Problem Solved

**Before caching:**
- Every template request queried the database
- With 100 templates × 1000 requests/hour = **100,000 database queries/hour**
- Increased latency (50-100ms per query)
- Unnecessary database load

**After caching:**
- First request: Database query (cache miss)
- Subsequent requests: In-memory cache (cache hit)
- Estimated reduction: **99%+ of database queries eliminated** (based on typical read:write ratio of 100:1 or higher)
- Response time: < 1ms for cache hits

## Implementation Details

### Cache Configuration

```typescript
private readonly cache: NodeCache;

constructor() {
  this.cache = new NodeCache({
    stdTTL: config.cacheTtlSeconds,  // Default: 3600s (1 hour)
    checkperiod: 600,                 // Check for expired keys every 10 min
    useClones: false,                 // No cloning = better performance
  });
}
```

### Cached Methods

All read operations are cached with unique cache keys:

| Method | Cache Key Pattern | Example |
|--------|------------------|---------|
| `findAll()` | `templates:all:{type}` | `templates:all:RESUME` |
| `findOne()` | `templates:id:{id}` | `templates:id:abc-123` |
| `findDefault()` | `templates:default:{type}` | `templates:default:COVER_LETTER` |
| `findByCategoryAndLanguage()` | `templates:category:{cat}:lang:{lang}:type:{type}` | `templates:category:modern:lang:en:type:RESUME` |
| `findLanguageVariants()` | `templates:variants:{baseId}` | `templates:variants:base-123` |

### Cache Invalidation

Cache is automatically cleared (all keys) when templates are mutated:

- `create()` - New template added
- `update()` - Existing template modified
- `delete()` - Template removed

**Rationale:** Simple "flush all" approach is safer than selective invalidation and still provides 99%+ hit rate since mutations are rare.

### Cache Metrics

The service tracks cache performance:

```typescript
const stats = templatesService.getCacheStats();
// {
//   hits: 1500,
//   misses: 50,
//   hitRate: 96.77,  // Percentage
//   keys: 12,        // Active cache entries
//   stats: { ... }   // node-cache internal stats
// }
```

**Logging:**
- Cache hits/misses logged at DEBUG level
- Cache invalidation logged at LOG level
- Stats include hit rate calculation

## Configuration

### Environment Variables

```bash
# .env
CACHE_TTL_SECONDS=3600  # 1 hour (default)
```

**TTL Guidelines:**
- Development: 3600s (1 hour) - good balance
- Production: 3600-7200s (1-2 hours) - templates change infrequently
- Testing: 60s - faster expiry for test isolation

### Adjusting TTL

**Longer TTL (7200s+):**
- ✅ Higher cache hit rate
- ✅ Lower database load
- ❌ Slower propagation of template updates

**Shorter TTL (900s):**
- ✅ Faster propagation of updates
- ❌ More cache misses
- ❌ Higher database load

## Performance Impact

### Expected Metrics

**Cache Hit Scenario** (99% of requests):
- Database queries: 0
- Response time: < 1ms
- Memory usage: ~10KB per cached template

**Cache Miss Scenario** (1% of requests):
- Database queries: 1-2 (with fallback logic)
- Response time: 50-100ms
- Memory usage: Same (cache populated)

### Scalability

**Single Instance:**
- In-memory cache works perfectly
- No external dependencies (Redis, Memcached)
- Minimal operational complexity

**Multi-Instance (Future):**
- Consider migrating to Redis for shared cache
- Current approach: Each instance has its own cache
- Trade-off: Slightly lower hit rate, but simpler architecture

## Monitoring

### Production Checklist

1. **Log Analysis:**
   ```bash
   # Check cache hit rate
   grep "Cache HIT" logs/app.log | wc -l
   grep "Cache MISS" logs/app.log | wc -l
   ```

2. **Performance:**
   - Monitor `/api/v1/templates` endpoint response time
   - Should be < 10ms for cached responses
   - Alert if P95 > 100ms

3. **Memory Usage:**
   - Monitor process memory (should be stable)
   - Templates cache: ~10KB × 100 templates = ~1MB
   - Alert if memory grows unexpectedly

### Debugging

**Enable verbose logging:**
```typescript
// In templates.service.ts
this.logger.debug(`Cache HIT for ${cacheKey}`);
this.logger.debug(`Cache MISS for ${cacheKey}`);
```

**Inspect cache state:**
```typescript
// Get cache stats via service
const stats = await templatesService.getCacheStats();
console.log(stats);
```

## Testing

### Unit Tests

Comprehensive test suite in `templates.service.cache.spec.ts`:

```bash
cd apps/api
npm run test:unit -- templates.service.cache.spec.ts
```

**Test Coverage:**
- ✅ Cache hits on repeated calls
- ✅ Cache misses on first call
- ✅ Separate cache keys per query variant
- ✅ Cache invalidation on mutations
- ✅ Hit rate calculation
- ✅ Fallback handling (e.g., English when German missing)

### Manual Testing

```bash
# 1. Start API
cd apps/api
npm run start:dev

# 2. First request (cache MISS - check logs)
curl http://localhost:3000/api/v1/templates

# 3. Second request (cache HIT - check logs)
curl http://localhost:3000/api/v1/templates

# 4. Check cache stats (if exposed via endpoint)
curl http://localhost:3000/api/v1/templates/cache/stats
```

## Migration Notes

### From No Caching (Current)

1. ✅ No database schema changes
2. ✅ No API changes
3. ✅ No frontend changes
4. ✅ Backward compatible

### To Redis (Future)

If scaling to multiple instances:

```typescript
// Replace node-cache with @nestjs/cache-manager + Redis
import { CacheModule } from '@nestjs/cache-manager';
import * as redisStore from 'cache-manager-redis-store';

@Module({
  imports: [
    CacheModule.register({
      store: redisStore,
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT,
      ttl: 3600,
    }),
  ],
})
```

**Migration Path:**
1. Install Redis dependencies
2. Update ConfigModule to use CacheModule
3. Replace `this.cache.get()` with `await this.cacheManager.get()`
4. Test thoroughly

## FAQ

**Q: Why not use Prisma query caching?**
A: Prisma caching is experimental and doesn't support our complex filtering logic (grouping by baseTemplateId, fallback to English, etc.).

**Q: Why flush all cache keys instead of selective invalidation?**
A: Simpler, safer, and negligible impact since mutations are rare (< 1% of requests).

**Q: Can I disable caching?**
A: Yes, set `CACHE_TTL_SECONDS=0` (cache disabled, all queries hit database).

**Q: What happens if cache expires during high load?**
A: All concurrent requests will query the database (thundering herd). Not an issue since templates are small and database can handle spikes.

**Q: How much memory does caching use?**
A: ~1MB for 100 templates. Negligible compared to Node.js baseline (~50MB).

## Related Documentation

- [Issue #220: Add caching strategy](https://github.com/Ar1anit/smart-apply/issues/220)
- [node-cache Documentation](https://www.npmjs.com/package/node-cache)
- [NestJS Caching](https://docs.nestjs.com/techniques/caching)

## Changelog

- **2025-12-12**: Initial implementation with node-cache (in-memory, single-instance)
- **Future**: Consider Redis for multi-instance deployments
