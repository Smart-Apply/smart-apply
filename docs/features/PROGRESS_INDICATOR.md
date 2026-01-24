# Visual Progress Indicator for PDF Generation

## Overview

The visual progress indicator provides real-time feedback to users during the PDF generation process. It replaces the generic "Wird erstellt..." message with a detailed progress bar showing percentage completion and current stage messages.

## User Experience Impact

**Before:**

- Users saw only "Wird erstellt..." with no indication of progress
- No way to know if generation was stuck or progressing normally
- Increased support requests: "Is it still working?"
- Users closing browser thinking process was frozen

**After:**

- Visual progress bar showing 0-100% completion
- Stage-specific messages in German (e.g., "Generiere Lebenslauf mit KI...")
- Real-time updates every 2 seconds via Server-Sent Events
- Clear indication of what's happening at each stage
- Reduced user anxiety and support requests

## Technical Architecture

### Backend (NestJS)

#### Progress Callback System

The backend uses an in-memory callback system to track progress across the generation pipeline:

```typescript
// Type definition
export type ProgressCallback = (progress: number, message: string) => void;

// In-memory storage (ApplicationsService)
private readonly progressCallbacks = new Map<string, ProgressCallback>();
```

#### Progress Emission Points

The `generateWithSinglePipeline` method emits progress at 8 key milestones:

| Progress | Stage                 | Message (German)                   | Duration     |
| -------- | --------------------- | ---------------------------------- | ------------ |
| 0%       | Start                 | Starte Generierung...              | Instant      |
| 10%      | Load Data             | Lade Profil und Stellenanzeige...  | <1s          |
| 20%      | Select Profile        | Wähle relevante Profildaten aus... | 5-10s (LLM)  |
| 40%      | Generate Resume       | Generiere Lebenslauf mit KI...     | 10-20s (LLM) |
| 60%      | Generate Cover Letter | Generiere Anschreiben mit KI...    | 10-20s (LLM) |
| 80%      | Extract Keywords      | Extrahiere ATS-Keywords...         | 5-10s (LLM)  |
| 95%      | Save Results          | Speichere Ergebnisse...            | <1s          |
| 100%     | Complete              | Fertig!                            | Instant      |

**Note:** If cover letter generation is disabled, step 60% shows "Überspringe Anschreiben-Generierung..." and completes quickly.

#### SSE Stream Implementation

The `streamStatus` endpoint emits progress data via Server-Sent Events:

```typescript
async streamStatus(userId: string, applicationId: string): Promise<Observable<MessageEvent>> {
  // Register progress callback for this application
  this.progressCallbacks.set(applicationId, (progress: number, message: string) => {
    lastProgress = progress;
    lastMessage = message;
  });

  // Poll database every 2 seconds and emit progress
  return interval(2000).pipe(
    switchMap(async () => {
      const application = await this.prisma.application.findFirst({...});
      return { application, progress: lastProgress, message: lastMessage };
    }),
    map(({ application, progress, message }) => ({
      data: {
        id: application.id,
        status: application.status,
        progress: progress,
        message: message,
        updatedAt: application.updatedAt,
      },
    })),
    // Close when READY or FAILED
    takeWhile((event) => {
      const status = event.data.status;
      return status === 'PENDING' || status === 'GENERATING';
    }, true),
  );
}
```

**Event Format:**

```json
{
  "data": {
    "id": "app-123",
    "status": "GENERATING",
    "progress": 40,
    "message": "Generiere Lebenslauf mit KI...",
    "updatedAt": "2024-01-15T10:30:00Z",
    "errorMessage": null
  }
}
```

### Frontend (Next.js)

#### State Management

The application detail page tracks progress using React state:

```typescript
const [progress, setProgress] = useState(0);
const [progressMessage, setProgressMessage] = useState('');
```

#### SSE Connection

EventSource API connects to the backend stream:

```typescript
useEffect(() => {
  // Only connect if status is PENDING or GENERATING
  if (application.status !== 'PENDING' && application.status !== 'GENERATING') {
    return;
  }

  const eventSource = new EventSource(
    `${process.env.NEXT_PUBLIC_API_URL}/applications/${applicationId}/stream`,
    { withCredentials: true }
  );

  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);

    // Update progress state
    if (data.progress !== undefined) {
      setProgress(data.progress);
    }
    if (data.message) {
      setProgressMessage(data.message);
    }

    // Update application status
    queryClient.setQueryData(['applications', applicationId], (old: any) => ({
      ...old,
      status: data.status,
    }));

    // Close connection when done
    if (data.status === 'READY' || data.status === 'FAILED') {
      refetch();
      eventSource.close();
    }
  };

  return () => eventSource.close();
}, [applicationId, application?.status]);
```

#### Progress Bar UI

The shadcn/ui Progress component provides the visual indicator:

```tsx
{application.status === 'GENERATING' && (
  <div className="space-y-3 mt-2">
    <p className="text-sm text-gray-600">
      Die KI erstellt gerade dein Anschreiben und deinen Lebenslauf.
    </p>

    {/* Progress bar with smooth animation */}
    <div className="space-y-2">
      <Progress value={progress} className="h-2" />

      {/* Current stage message */}
      {progressMessage && (
        <p className="text-sm text-gray-700 font-medium">
          {progressMessage}
        </p>
      )}

      {/* Percentage text */}
      {progress > 0 && (
        <p className="text-xs text-gray-500">
          {progress}% abgeschlossen
        </p>
      )}
    </div>
  </div>
)}
```

## Design Decisions

### Why In-Memory Callbacks?

**Pros:**

- ✅ Simple implementation
- ✅ No database overhead
- ✅ Real-time updates (no polling lag)
- ✅ Automatic cleanup via Map

**Cons:**

- ❌ Lost on server restart
- ❌ Not shared across multiple instances
- ❌ No persistence for debugging

**Trade-off:** For MVP, simplicity wins. Future could persist to Redis for multi-instance setups.

### Why 2-Second Polling Interval?

**Rationale:**

- Balance between responsiveness and server load
- LLM stages take 5-20 seconds, so 2s provides 2-10 updates per stage
- Lower than 1s could overwhelm database
- Higher than 3s feels sluggish

### Why Manual Cleanup vs. Auto-Reconnect?

**Current:** SSE connection closes on error, requires manual page refresh

**Rationale:**

- Prevents rate limit issues from constant reconnections
- Simple implementation for MVP
- Users can refresh if needed

**Future:** Implement exponential backoff reconnection with max retries

### Why Not WebSockets?

**SSE Advantages:**

- Simpler to implement (HTTP, not separate protocol)
- Built-in reconnection (browser handles it)
- Better firewall/proxy compatibility
- One-way communication sufficient (server → client)

**WebSocket Would Provide:**

- Bi-directional communication (not needed)
- Lower latency (2s polling is acceptable)
- More complex infrastructure

## Performance Considerations

### Backend

**Memory Usage:**

- Each active generation: 1 callback entry in Map
- Typical size: 8 bytes (string key) + function pointer
- 100 concurrent generations: <1 KB overhead

**Database Load:**

- SSE polls every 2 seconds per connection
- Query is lightweight (SELECT id, status, updatedAt)
- Indexed on primary key (fast lookup)
- 100 concurrent streams: 50 queries/second

### Frontend

**Network:**

- SSE connection: ~100 bytes per event
- Total data for full generation: ~800 bytes (8 updates × 100 bytes)
- Minimal impact on bandwidth

**Rendering:**

- Progress bar updates trigger re-render
- Optimized via React.memo (if needed)
- CSS transition-all provides smooth animation

## Limitations and Future Enhancements

### Current Limitations

1. **No Estimated Time Remaining**
   - Users see progress but not ETA
   - Could add: "ca. 30 Sekunden verbleibend"

2. **No Progress Persistence**
   - Progress lost on page refresh
   - Requires SSE reconnection to resume

3. **No Automatic Reconnection**
   - Network interruptions require manual refresh
   - Could implement exponential backoff

4. **Single-Instance Only**
   - In-memory callbacks don't scale across multiple backend instances
   - Redis/pub-sub needed for horizontal scaling

### Potential Enhancements

#### 1. Estimated Time Remaining

Track historical durations per stage:

```typescript
const avgDurations = {
  selectProfile: 8000, // 8s average
  generateResume: 15000, // 15s average
  generateCoverLetter: 12000, // 12s average
  extractKeywords: 6000, // 6s average
};

const calculateETA = (currentProgress: number) => {
  const remainingStages = stages.filter(s => s.progress > currentProgress);
  const eta = remainingStages.reduce((sum, s) => sum + avgDurations[s.name], 0);
  return `ca. ${Math.ceil(eta / 1000)} Sekunden verbleibend`;
};
```

#### 2. Progress Persistence

Store progress in database:

```prisma
model Application {
  // ... existing fields
  generationProgress Int? // 0-100
  generationMessage String? // Current stage message
}
```

Update on each milestone:

```typescript
await this.prisma.application.update({
  where: { id: applicationId },
  data: {
    generationProgress: progress,
    generationMessage: message,
  },
});
```

#### 3. Automatic Reconnection

Exponential backoff for SSE:

```typescript
const [retryCount, setRetryCount] = useState(0);
const [isReconnecting, setIsReconnecting] = useState(false);

eventSource.onerror = () => {
  eventSource.close();

  if (retryCount < 5) {
    const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
    setTimeout(() => {
      setRetryCount(prev => prev + 1);
      setIsReconnecting(true);
      // Reconnect logic here
    }, delay);
  }
};
```

#### 4. Multi-Instance Support

Use Redis pub/sub for progress broadcasts:

```typescript
// Publisher (generation worker)
await redis.publish(
  `application:${id}:progress`,
  JSON.stringify({ progress, message })
);

// Subscriber (SSE handler)
redis.subscribe(`application:${id}:progress`, (channel, data) => {
  observer.next({ data: JSON.parse(data) });
});
```

## Security Considerations

### Authentication

- SSE endpoint protected by JWT guard
- Only application owner can stream progress
- Verified via `ensureApplicationOwnership()`

### Rate Limiting

- SSE streams excluded from throttling (`@SkipThrottle()`)
- Long-lived connections are expected behavior
- Future: Could limit max concurrent streams per user

### Data Exposure

- Progress messages are generic (no PII)
- No profile/job data leaked in events
- Only application ID, status, progress, timestamp

## Testing

See [PROGRESS_INDICATOR_TESTING.md](../testing/PROGRESS_INDICATOR_TESTING.md) for comprehensive test scenarios.

## References

- **Issue:** #[TBD] - Add visual progress indicator for PDF generation
- **Backend Code:** `apps/api/src/applications/applications.service.ts`
- **Frontend Code:** `apps/web/src/app/(dashboard)/applications/[id]/page.tsx`
- **Progress Component:** `apps/web/src/components/ui/progress.tsx`
- **DTO:** `apps/api/src/applications/dto/application-progress.dto.ts`
