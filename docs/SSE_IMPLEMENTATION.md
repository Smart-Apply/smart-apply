# Server-Sent Events (SSE) Implementation

## Overview

The Smart Apply application uses Server-Sent Events (SSE) to provide real-time status updates for application generation pipeline. This is more efficient than polling as it uses a push-based model.

## Backend Implementation

### Endpoint

```
GET /api/v1/applications/:id/stream
```

**Authentication:** Required (JWT via HttpOnly cookie)

**Response Headers:**
- `Content-Type: text/event-stream`
- `Cache-Control: no-cache`
- `Connection: keep-alive`

### How It Works

1. **Client initiates connection:** Frontend creates EventSource connection to the stream endpoint
2. **Server polls database:** Every 2 seconds, the server queries the application status
3. **Server sends updates:** Status changes are pushed to client as SSE events
4. **Auto-close:** Connection automatically closes when status reaches `READY` or `FAILED`

### Technical Details

**Implementation:** RxJS Observable with `interval` operator
- Polls every 2 seconds
- Uses `switchMap` to fetch latest application data
- Uses `takeWhile` to close stream on final status

**Stream Format:**
```typescript
{
  data: {
    id: string;
    status: "PENDING" | "GENERATING" | "READY" | "FAILED";
    updatedAt: string;
    errorMessage: string | null;
  }
}
```

### Code Example

```typescript
// In ApplicationsService
async streamStatus(userId: string, applicationId: string): Promise<Observable<MessageEvent>> {
  await this.ensureApplicationOwnership(userId, applicationId);

  return interval(2000).pipe(
    switchMap(async () => {
      const application = await this.prisma.application.findFirst({
        where: { id: applicationId, userId },
        select: { id: true, status: true, updatedAt: true, errorMessage: true },
      });
      return application;
    }),
    map((application) => ({
      data: {
        id: application.id,
        status: application.status,
        updatedAt: application.updatedAt,
        errorMessage: application.errorMessage,
      },
    } as MessageEvent)),
    takeWhile((event: any) => {
      const status = event.data.status;
      return status === 'PENDING' || status === 'GENERATING';
    }, true), // true ensures final status is emitted before closing
  );
}
```

## Frontend Implementation

### Hook: `useApplicationStream`

```typescript
import { useApplicationStream } from '@/hooks/use-application-stream';

function ApplicationDetails({ applicationId }) {
  const { status, error, isConnected } = useApplicationStream(applicationId);
  const { data: application } = useApplication(applicationId);

  // Use live status if available, otherwise fallback to React Query data
  const currentStatus = status || application?.status;

  return (
    <div>
      <StatusBadge status={currentStatus} />
      {isConnected && <span>🟢 Live updates</span>}
      {error && <span>⚠️ {error}</span>}
    </div>
  );
}
```

### Hook Features

- **Automatic Connection:** Connects when component mounts
- **Automatic Cleanup:** Closes connection when component unmounts
- **Built-in Reconnection:** EventSource automatically reconnects on connection loss
- **Error Handling:** Tracks connection errors and state
- **Credentials:** Includes cookies for JWT authentication

## Advantages Over Polling

### SSE Benefits
- ✅ **Push-based:** Server sends updates immediately
- ✅ **Efficient:** Single long-lived connection instead of repeated requests
- ✅ **Standard:** Built-in browser API (EventSource)
- ✅ **Automatic Reconnection:** Browser handles reconnection automatically
- ✅ **Lower Latency:** Instant updates without polling delay

### Polling Drawbacks
- ❌ Wastes bandwidth with repeated requests
- ❌ Higher latency (depends on polling interval)
- ❌ More server load (N requests per minute per client)
- ❌ Complex client-side logic for retry/reconnection

## When to Use Each

### Use SSE When:
- Real-time updates are important (application status, live dashboards)
- Multiple status changes expected
- User is actively watching for updates
- Mobile/responsive experience needed

### Use Polling When:
- Updates are infrequent
- User is not actively watching
- Background sync (e.g., every 5 minutes)
- Compatibility with older browsers needed

## Configuration

### Backend Environment Variables
No additional configuration needed. SSE uses existing:
- `JWT_SECRET` for authentication
- `CORS_ORIGINS` for allowed origins
- `DATABASE_URL` for data access

### Frontend Environment Variables
```bash
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
```

## Testing

### E2E Tests
Located in: `apps/api/test/applications.e2e-spec.ts`

Tests verify:
- ✅ SSE endpoint returns correct headers (`text/event-stream`)
- ✅ Authentication required (401 without token)
- ✅ Authorization (404 for non-existent or unauthorized application)
- ✅ Response format matches expected structure

### Manual Testing

1. **Start backend:**
   ```bash
   cd apps/api && npm run start:dev
   ```

2. **Start frontend:**
   ```bash
   cd apps/web && npm run dev
   ```

3. **Create application:**
   - Login to frontend
   - Create a new application from a job posting

4. **Watch SSE stream:**
   - Open browser DevTools → Network tab
   - Filter by "EventStream" type
   - Watch status updates in real-time

## Browser Compatibility

EventSource API is supported in all modern browsers:
- ✅ Chrome/Edge 6+
- ✅ Firefox 6+
- ✅ Safari 5+
- ✅ Opera 11+
- ❌ Internet Explorer (use polling fallback)

## Future Enhancements

### Event Emitter Integration (Post-MVP)
Instead of polling every 2 seconds, integrate with job queue events:

```typescript
// Worker emits event after status update
await this.eventEmitter.emit('application.status.changed', {
  applicationId,
  status: 'READY',
});

// SSE endpoint listens to events
@Get(':id/stream')
@Sse()
streamStatus(@Param('id') id: string) {
  return fromEvent(this.eventEmitter, 'application.status.changed').pipe(
    filter((event: any) => event.applicationId === id),
    map((event) => ({ data: event })),
  );
}
```

**Benefits:**
- Instant updates (no 2-second delay)
- No database polling (lower load)
- More scalable architecture

**Trade-offs:**
- Requires event emitter setup
- More complex architecture
- Events must be reliable

### Additional Features
- Multiple event types (progress updates, logs)
- Reconnection with exponential backoff
- Heartbeat to detect stale connections
- Compression for large event payloads

## References

- [MDN EventSource API](https://developer.mozilla.org/en-US/docs/Web/API/EventSource)
- [NestJS SSE Documentation](https://docs.nestjs.com/techniques/server-sent-events)
- [RxJS Operators](https://rxjs.dev/guide/operators)
- [HTML5 Server-Sent Events Spec](https://html.spec.whatwg.org/multipage/server-sent-events.html)
