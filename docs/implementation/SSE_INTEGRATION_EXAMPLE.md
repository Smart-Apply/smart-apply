# SSE Integration Example

This guide shows how to integrate the `useApplicationStream` hook into your application components for real-time status updates.

## Basic Integration

### Application Detail Page

```typescript
// apps/web/src/app/(dashboard)/applications/[id]/page.tsx
'use client';

import { useParams } from 'next/navigation';
import { useApplication } from '@/hooks/use-applications';
import { useApplicationStream } from '@/hooks/use-application-stream';
import { StatusBadge } from '@/components/status-badge';

export default function ApplicationDetailPage() {
  const params = useParams();
  const applicationId = params.id as string;

  // Fetch initial application data (React Query with caching)
  const { data: application, isLoading } = useApplication(applicationId);

  // Stream real-time status updates (SSE)
  const { status: liveStatus, error: streamError, isConnected } = useApplicationStream(applicationId);

  // Use live status if available, otherwise fallback to React Query data
  const currentStatus = liveStatus || application?.status || 'PENDING';

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header with live status */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Application Details</h1>
        <div className="flex items-center gap-2">
          <StatusBadge status={currentStatus} />
          {isConnected && (
            <span className="text-xs text-green-600 flex items-center gap-1">
              <span className="w-2 h-2 bg-green-600 rounded-full animate-pulse" />
              Live updates
            </span>
          )}
          {streamError && (
            <span className="text-xs text-red-600">{streamError}</span>
          )}
        </div>
      </div>

      {/* Application content */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h3 className="font-semibold">Job Title</h3>
          <p>{application?.jobPosting?.title}</p>
        </div>
        <div>
          <h3 className="font-semibold">Company</h3>
          <p>{application?.jobPosting?.company}</p>
        </div>
        <div>
          <h3 className="font-semibold">Status</h3>
          <p>{currentStatus}</p>
        </div>
        <div>
          <h3 className="font-semibold">Last Updated</h3>
          <p>{new Date(application?.updatedAt || '').toLocaleString()}</p>
        </div>
      </div>

      {/* Show loading state during generation */}
      {(currentStatus === 'PENDING' || currentStatus === 'GENERATING') && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
            <div>
              <p className="font-semibold text-blue-900">
                {currentStatus === 'PENDING' ? 'Queued for processing...' : 'Generating documents...'}
              </p>
              <p className="text-sm text-blue-700">
                This usually takes 30-60 seconds. You'll see updates in real-time.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Show success state */}
      {currentStatus === 'READY' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="font-semibold text-green-900">✓ Documents ready!</p>
          <p className="text-sm text-green-700">Your cover letter and resume are ready to download.</p>
          {/* Add download buttons here */}
        </div>
      )}

      {/* Show error state */}
      {currentStatus === 'FAILED' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="font-semibold text-red-900">✗ Generation failed</p>
          <p className="text-sm text-red-700">
            {application?.errorMessage || 'An error occurred while generating documents.'}
          </p>
        </div>
      )}
    </div>
  );
}
```

## Application List with Live Updates

```typescript
// apps/web/src/app/(dashboard)/applications/page.tsx
'use client';

import { useApplications } from '@/hooks/use-applications';
import { useApplicationStream } from '@/hooks/use-application-stream';
import { ApplicationCard } from '@/components/application-card';

export default function ApplicationsPage() {
  const { data: applications, isLoading } = useApplications();

  if (isLoading) {
    return <div>Loading applications...</div>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">My Applications</h1>
      <div className="grid gap-4">
        {applications?.map((application) => (
          <ApplicationCardWithLiveStatus
            key={application.id}
            application={application}
          />
        ))}
      </div>
    </div>
  );
}

function ApplicationCardWithLiveStatus({ application }) {
  // Only stream status for applications that are in progress
  const shouldStream = application.status === 'PENDING' || application.status === 'GENERATING';
  
  const { status: liveStatus, isConnected } = useApplicationStream(
    shouldStream ? application.id : undefined
  );

  const currentStatus = liveStatus || application.status;

  return (
    <ApplicationCard
      application={{ ...application, status: currentStatus }}
      showLiveIndicator={isConnected}
    />
  );
}
```

## Toast Notifications for Status Changes

```typescript
// apps/web/src/hooks/use-application-stream-with-toast.ts
import { useEffect, useRef } from 'react';
import { useApplicationStream } from './use-application-stream';
import { toast } from 'sonner';
import type { ApplicationStatus } from '@/types';

export function useApplicationStreamWithToast(applicationId: string | undefined) {
  const { status, error, isConnected } = useApplicationStream(applicationId);
  const previousStatusRef = useRef<ApplicationStatus | null>(null);

  // Show toast notifications when status changes
  useEffect(() => {
    if (!status || status === previousStatusRef.current) {
      return;
    }

    const previousStatus = previousStatusRef.current;
    previousStatusRef.current = status;

    // Don't show toast for initial status
    if (!previousStatus) {
      return;
    }

    // Show appropriate toast based on status transition
    if (status === 'GENERATING' && previousStatus === 'PENDING') {
      toast.info('Generating documents...', {
        description: 'Your cover letter and resume are being created.',
      });
    } else if (status === 'READY') {
      toast.success('Documents ready! 🎉', {
        description: 'Your cover letter and resume are ready to download.',
        duration: 5000,
      });
    } else if (status === 'FAILED') {
      toast.error('Generation failed', {
        description: 'There was an error generating your documents.',
        action: {
          label: 'Retry',
          onClick: () => {
            // Add retry logic here
          },
        },
      });
    }
  }, [status]);

  // Show error toast if connection fails
  useEffect(() => {
    if (error) {
      toast.error('Connection error', {
        description: error,
      });
    }
  }, [error]);

  return { status, error, isConnected };
}
```

## Conditional Streaming (Performance Optimization)

Only stream status for applications that are actively being processed:

```typescript
function ApplicationsList() {
  const { data: applications } = useApplications();

  return (
    <>
      {applications?.map((app) => {
        // Only enable streaming for in-progress applications
        const shouldStream = app.status === 'PENDING' || app.status === 'GENERATING';
        
        return (
          <ApplicationItem
            key={app.id}
            application={app}
            enableStream={shouldStream}
          />
        );
      })}
    </>
  );
}

function ApplicationItem({ application, enableStream }) {
  const { status: liveStatus } = useApplicationStream(
    enableStream ? application.id : undefined
  );

  const currentStatus = liveStatus || application.status;

  return (
    <div>
      <h3>{application.jobPosting?.title}</h3>
      <StatusBadge status={currentStatus} />
    </div>
  );
}
```

## Error Handling and Recovery

```typescript
function RobustApplicationStatus({ applicationId }) {
  const { status, error, isConnected } = useApplicationStream(applicationId);
  const { data: application } = useApplication(applicationId);

  // Handle various error scenarios
  if (error && !isConnected) {
    return (
      <div className="text-amber-600">
        <p>⚠️ Live updates temporarily unavailable</p>
        <p className="text-sm">
          Status: {application?.status || 'Unknown'}
        </p>
        <button onClick={() => window.location.reload()}>
          Refresh page
        </button>
      </div>
    );
  }

  const currentStatus = status || application?.status;

  return (
    <div>
      <StatusBadge status={currentStatus} />
      {isConnected && (
        <span className="text-xs text-green-600">● Live</span>
      )}
    </div>
  );
}
```

## Best Practices

### 1. **Conditional Streaming**
Only stream status for applications that need real-time updates (PENDING or GENERATING). Avoid streaming for completed applications.

```typescript
const shouldStream = status === 'PENDING' || status === 'GENERATING';
const { status: liveStatus } = useApplicationStream(shouldStream ? id : undefined);
```

### 2. **Fallback to Cached Data**
Always provide a fallback to React Query cached data in case SSE is unavailable:

```typescript
const currentStatus = liveStatus || application?.status || 'PENDING';
```

### 3. **Visual Feedback**
Show users when they're receiving live updates with a visual indicator:

```typescript
{isConnected && <span className="text-green-600">● Live</span>}
```

### 4. **Error Handling**
Handle connection errors gracefully and provide recovery options:

```typescript
{error && (
  <div className="text-amber-600">
    <p>{error}</p>
    <p className="text-sm">Connection will retry automatically.</p>
  </div>
)}
```

### 5. **Performance**
The hook automatically cleans up connections when the component unmounts, but be mindful of:
- Don't create multiple streams for the same application
- Use conditional streaming to reduce server load
- Consider debouncing status changes in UI updates

## Testing

### Manual Testing

1. **Start backend:**
   ```bash
   cd apps/api && npm run start:dev
   ```

2. **Start frontend:**
   ```bash
   cd apps/web && npm run dev
   ```

3. **Create application and watch:**
   - Login to frontend
   - Create a new application
   - Watch status change from PENDING → GENERATING → READY in real-time
   - Check browser DevTools Network tab for EventStream

### Browser DevTools

1. Open DevTools → Network tab
2. Filter by "EventStream" type
3. Click on the stream connection
4. View "EventStream" tab to see real-time events
5. Verify events contain correct status data

## Troubleshooting

### Issue: No live updates
**Solution:** Check browser console for errors. Verify:
- Backend is running on correct port
- CORS is configured properly
- JWT token is present in cookies

### Issue: Connection keeps reconnecting
**Solution:** This is normal behavior when status reaches final state (READY/FAILED). The connection should close automatically.

### Issue: Multiple connections
**Solution:** Ensure component isn't remounting unnecessarily. Use React DevTools to check component lifecycle.

### Issue: 401 Unauthorized
**Solution:** User needs to be logged in. JWT token must be present in HttpOnly cookies.

## Related Documentation

- [SSE Implementation Guide](./SSE_IMPLEMENTATION.md) - Technical details
- [Applications API](../README.md#applications-endpoints) - API documentation
- [React Query Hooks](../apps/web/src/hooks/use-applications.ts) - Data fetching hooks
