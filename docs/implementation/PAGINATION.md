# Pagination Implementation

## Overview

This document describes the pagination implementation for all list endpoints in the Smart Apply API to prevent performance degradation at scale (20k+ users).

## Implementation Details

### DTOs Created

#### PaginationQueryDto (`apps/api/src/common/dto/pagination-query.dto.ts`)

```typescript
export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;  // Default: 1

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;  // Default: 20, Max: 100
}
```

#### PaginatedResponseDto (`apps/api/src/common/dto/paginated-response.dto.ts`)

```typescript
export class PaginatedResponseDto<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

### Affected Endpoints

#### 1. Applications

**Endpoint:** `GET /api/v1/applications`

**Query Parameters:**

- `page` (optional, default: 1): Page number (min: 1)
- `limit` (optional, default: 20): Items per page (min: 1, max: 100)
- `includeJobPosting` (optional, default: false): Include job posting details

**Response:**

```json
{
  "items": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

**Changes:**

- `ApplicationsService.findAll()` now returns paginated results
- Uses `Promise.all()` to fetch items and count in parallel
- Applies `take` and `skip` for pagination
- Returns both `items` and `pagination` metadata

#### 2. Job Postings

**Endpoint:** `GET /api/v1/job-postings`

**Query Parameters:**

- `page` (optional, default: 1): Page number (min: 1)
- `limit` (optional, default: 20): Items per page (min: 1, max: 100)

**Response:** Same structure as Applications

**Changes:**

- `JobPostingsService.listJobPostings()` now supports pagination
- Parallel query for items and total count
- Returns paginated response structure

#### 3. Sessions

**Endpoint:** `GET /api/v1/auth/sessions`

**Query Parameters:**

- `page` (optional, default: 1): Page number (min: 1)
- `limit` (optional, default: 20): Items per page (min: 1, max: 100)

**Response:** Same structure as Applications

**Changes:**

- `SessionService.getActiveSessions()` now supports pagination
- Added `getAllActiveSessionsInternal()` private method for session limit checks (no pagination)
- Returns paginated response structure

### Environment Configuration

Added to `env.schema.ts`:

```typescript
DEFAULT_PAGE_SIZE: z.string().default('20'),
MAX_PAGE_SIZE: z.string().default('100'),
```

Added to `config.service.ts`:

```typescript
get defaultPageSize(): number {
  return parseInt(this.nestConfig.get('DEFAULT_PAGE_SIZE', { infer: true }), 10);
}

get maxPageSize(): number {
  return parseInt(this.nestConfig.get('MAX_PAGE_SIZE', { infer: true }), 10);
}
```

### Database Query Optimization

**Before (No Pagination):**

```typescript
await this.prisma.application.findMany({
  where: { userId },
  orderBy: { createdAt: 'desc' },
});
```

- ⚠️ Loads ALL records (could be 200k+ at scale)
- ⚠️ High memory usage
- ⚠️ Slow response times

**After (With Pagination):**

```typescript
const [items, total] = await Promise.all([
  this.prisma.application.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: (page - 1) * limit,
  }),
  this.prisma.application.count({
    where: { userId },
  }),
]);
```

- ✅ Loads only requested page (20-100 items)
- ✅ Parallel queries for items and count
- ✅ Efficient memory usage
- ✅ Fast response times

### Validation

The following validations are enforced:

- `page` must be >= 1 (returns 400 Bad Request if invalid)
- `limit` must be between 1 and 100 (returns 400 Bad Request if > 100)
- Both parameters are optional (defaults: page=1, limit=20)
- Parameters are transformed to numbers via `@Type(() => Number)`

### Examples

#### Request first page (default limit 20)

```bash
GET /api/v1/applications
```

#### Request second page with custom limit

```bash
GET /api/v1/applications?page=2&limit=10
```

#### Request with maximum limit

```bash
GET /api/v1/applications?limit=100
```

#### Invalid requests (return 400)

```bash
GET /api/v1/applications?page=0      # page must be >= 1
GET /api/v1/applications?limit=101   # limit max is 100
GET /api/v1/applications?page=-1     # page must be >= 1
```

### Performance Impact

**Scenario:** User with 10 applications

- **Before:** Loads all 10 applications
- **After:** Loads all 10 applications (same)
- **Impact:** Minimal

**Scenario:** Power user with 200 applications at 20k users

- **Before:** Loads all 200 applications (200 × 20k = 4M database rows, ~500MB payload)
- **After:** Loads 20 applications (20 × 20k = 400k database rows, ~50MB payload)
- **Impact:** 90% reduction in database load, 90% reduction in payload size

### Testing

Comprehensive E2E tests added in `test/e2e/features/pagination.e2e-spec.ts`:

**Test Coverage:**

- ✅ Default pagination (page=1, limit=20)
- ✅ Custom page and limit
- ✅ Total pages calculation
- ✅ Max limit enforcement (100)
- ✅ Validation errors (page=0, page=-1, limit=101)
- ✅ Empty results for page beyond total
- ✅ All three endpoints (applications, job-postings, sessions)

### Migration Guide for Frontend

**Before:**

```typescript
const applications = await fetch('/api/v1/applications');
// Returns: ApplicationResponseDto[]
```

**After:**

```typescript
const response = await fetch('/api/v1/applications?page=1&limit=20');
// Returns: { items: ApplicationResponseDto[], pagination: PaginationMetadata }

// Access items
const applications = response.items;

// Access pagination metadata
console.log(response.pagination.total);  // Total count
console.log(response.pagination.totalPages);  // Number of pages
```

### Swagger Documentation

All paginated endpoints now include:

- Query parameter documentation for `page` and `limit`
- Response schema showing `items` and `pagination` structure
- Example values (page: 1, limit: 20, total: 100, totalPages: 5)

### Future Enhancements

1. **Cursor-based pagination** for better performance with large datasets
2. **Sorting parameters** (e.g., `?sort=createdAt:desc`)
3. **Filtering parameters** (e.g., `?status=PENDING`)
4. **GraphQL-style field selection** to reduce payload size further

## Summary

✅ All list endpoints now support pagination
✅ Default limit: 20, max limit: 100
✅ Parallel database queries for optimal performance
✅ Comprehensive validation and error handling
✅ Full E2E test coverage
✅ Swagger documentation updated
✅ Ready for production at 20k+ users scale
