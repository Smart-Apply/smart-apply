# API Response Standardization

## Overview

All API endpoints return responses in a standardized format for consistency and better frontend handling. This document describes the response structure and migration guide.

## Response Formats

### Success Responses (Single Item)

All successful responses wrap the data in a consistent structure:

```json
{
  "data": {
    "id": "user-123",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe"
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

**Structure:**
- `data` (any): The actual response data (object, array, string, etc.)
- `meta` (object): Response metadata
  - `timestamp` (string): ISO 8601 timestamp when response was generated
  - `requestId` (string, optional): Unique request ID for tracing (future enhancement)

### Success Responses (Paginated Lists)

List endpoints that support pagination return data in this format:

```json
{
  "data": {
    "items": [
      { "id": "1", "name": "Item 1" },
      { "id": "2", "name": "Item 2" }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8
    }
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

**Pagination Object:**
- `page` (number): Current page number (1-indexed)
- `limit` (number): Items per page (max: 100, default: 20)
- `total` (number): Total number of items across all pages
- `totalPages` (number): Total number of pages

**Paginated Endpoints:**
- `GET /api/v1/applications?page=1&limit=20`
- `GET /api/v1/job-postings?page=1&limit=20`

### Error Responses

All error responses follow this structure:

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "code": "VALIDATION_ERROR",
  "errors": [
    {
      "field": "email",
      "message": "Email must be a valid email address"
    }
  ],
  "meta": {
    "timestamp": "2024-01-15T10:30:00.000Z",
    "path": "/api/v1/profile",
    "method": "PUT"
  }
}
```

**Structure:**
- `statusCode` (number): HTTP status code (400, 401, 404, 500, etc.)
- `message` (string | string[]): Error message(s)
- `code` (string, optional): Machine-readable error code (e.g., `VALIDATION_ERROR`, `UNAUTHORIZED`)
- `errors` (array, optional): Detailed validation errors
- `meta` (object): Error metadata
  - `timestamp` (string): ISO 8601 timestamp when error occurred
  - `path` (string): Request path
  - `method` (string): HTTP method

**Common Error Codes:**
- `VALIDATION_ERROR` - Invalid input data
- `UNAUTHORIZED` - Authentication required
- `FORBIDDEN` - Access denied
- `NOT_FOUND` - Resource not found
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `INTERNAL_SERVER_ERROR` - Server error

## Implementation Details

### Backend (NestJS)

**TransformInterceptor:**
```typescript
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => ({
        data,
        meta: {
          timestamp: new Date().toISOString(),
        },
      })),
    );
  }
}
```

**Applied globally in `main.ts`:**
```typescript
app.useGlobalInterceptors(new TransformInterceptor());
```

**Error Filter:**
```typescript
const errorResponse = {
  statusCode: status,
  message,
  ...(errorCode && { code: errorCode }),
  ...(errors && { errors }),
  meta: {
    timestamp: new Date().toISOString(),
    path: request.url,
    method: request.method,
  },
};
```

### Frontend (Next.js)

**Automatic Data Unwrapping:**

The `api-client.ts` automatically unwraps the `data` field:

```typescript
const json = await response.json();

// Unwrap standardized API response format { data, meta }
if (json && typeof json === 'object' && 'data' in json && 'meta' in json) {
  return json.data as T;
}

// Fallback for backward compatibility
return json as T;
```

**Pagination Handling:**

Hooks extract `items` from paginated responses:

```typescript
export function useApplications() {
  return useQuery<Application[]>({
    queryKey: ['applications'],
    queryFn: async () => {
      const response = await api.applications.list();
      return response.items; // Extract items from { items, pagination }
    },
  });
}
```

## Migration Guide

### For Backend Developers

**No changes needed!** The `TransformInterceptor` is applied globally and automatically wraps all controller responses.

**Exception:** If you're manually setting HTTP status codes or headers, ensure you still return data from the controller:

```typescript
// ✅ Good - Interceptor will wrap this
@HttpCode(HttpStatus.CREATED)
async create(@Body() dto: CreateDto) {
  return this.service.create(dto);
}

// ✅ Good - Special case for 204 No Content
@HttpCode(HttpStatus.NO_CONTENT)
async delete(@Param('id') id: string): Promise<void> {
  await this.service.delete(id);
  // No return needed - interceptor skips void responses
}
```

### For Frontend Developers

**Minimal changes:** The `api-client.ts` automatically unwraps responses.

**List Endpoints:** Update hooks to extract `items` from paginated responses:

```typescript
// Before
queryFn: () => api.jobPostings.list()

// After
queryFn: async () => {
  const response = await api.jobPostings.list();
  return response.items;
}
```

**Type Updates:** Use `PaginatedResponse<T>` for list endpoint types:

```typescript
// Before
list: () => apiRequest<JobPosting[]>('/job-postings')

// After
list: () => apiRequest<PaginatedResponse<JobPosting>>('/job-postings')
```

## Benefits

1. **Consistency:** All responses follow the same structure
2. **Debugging:** Timestamps help correlate frontend/backend logs
3. **Type Safety:** Shared types ensure consistency between frontend and backend
4. **Error Handling:** Standardized error format makes frontend error handling easier
5. **Pagination:** Built-in pagination metadata eliminates guesswork
6. **Future Extensibility:** Easy to add request IDs, rate limit info, etc. to `meta`

## Backward Compatibility

The frontend `api-client.ts` includes fallback logic to handle both old and new response formats:

```typescript
// New format: { data, meta }
if (json && 'data' in json && 'meta' in json) {
  return json.data;
}

// Old format: direct response
return json;
```

This ensures gradual migration without breaking existing functionality.

## Testing

**Unit Tests:**
- ✅ `TransformInterceptor` wraps single objects
- ✅ `TransformInterceptor` wraps arrays
- ✅ `TransformInterceptor` wraps paginated responses
- ✅ ISO 8601 timestamp validation

**Integration Tests:**
- Manual API testing via Swagger UI
- Frontend integration testing
- E2E test verification

## Examples

### Example 1: Get User Profile

**Request:**
```http
GET /api/v1/profile
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "data": {
    "id": "profile-123",
    "userId": "user-456",
    "summary": "Full-stack developer with 5 years experience",
    "skills": [
      { "id": "1", "name": "TypeScript", "level": "Expert" },
      { "id": "2", "name": "React", "level": "Advanced" }
    ],
    "experiences": [...],
    "education": [...]
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

### Example 2: List Applications (Paginated)

**Request:**
```http
GET /api/v1/applications?page=2&limit=10
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "data": {
    "items": [
      {
        "id": "app-123",
        "status": "READY",
        "jobPostingId": "job-456",
        "createdAt": "2024-01-15T08:00:00.000Z"
      },
      {
        "id": "app-124",
        "status": "GENERATING",
        "jobPostingId": "job-457",
        "createdAt": "2024-01-15T09:30:00.000Z"
      }
    ],
    "pagination": {
      "page": 2,
      "limit": 10,
      "total": 45,
      "totalPages": 5
    }
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

### Example 3: Validation Error

**Request:**
```http
PUT /api/v1/profile
Content-Type: application/json

{
  "email": "invalid-email",
  "phone": "123"
}
```

**Response (400 Bad Request):**
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "code": "VALIDATION_ERROR",
  "errors": [
    {
      "property": "email",
      "constraints": {
        "isEmail": "email must be an email"
      }
    },
    {
      "property": "phone",
      "constraints": {
        "isPhoneNumber": "Phone number must be in international format"
      }
    }
  ],
  "meta": {
    "timestamp": "2024-01-15T10:30:00.000Z",
    "path": "/api/v1/profile",
    "method": "PUT"
  }
}
```

### Example 4: Authentication Error

**Request:**
```http
GET /api/v1/applications
Authorization: Bearer <expired-token>
```

**Response (401 Unauthorized):**
```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "code": "UNAUTHORIZED",
  "meta": {
    "timestamp": "2024-01-15T10:30:00.000Z",
    "path": "/api/v1/applications",
    "method": "GET"
  }
}
```

## Related Files

**Backend:**
- `apps/api/src/common/interceptors/transform.interceptor.ts`
- `apps/api/src/common/filters/all-exceptions.filter.ts`
- `apps/api/src/main.ts`

**Shared Types:**
- `packages/shared/src/index.ts`

**Frontend:**
- `apps/web/src/lib/api-client.ts`
- `apps/web/src/hooks/use-applications.ts`
- `apps/web/src/hooks/use-job-postings.ts`

## Future Enhancements

1. **Request ID Tracing:** Add unique request ID in `meta.requestId` for correlation
2. **Rate Limit Info:** Include rate limit status in `meta` (remaining requests, reset time)
3. **Deprecation Warnings:** Add `meta.deprecated` flag for deprecated endpoints
4. **Performance Metrics:** Include `meta.duration` for request processing time
5. **Cache Headers:** Add `meta.cached` flag for cached responses
