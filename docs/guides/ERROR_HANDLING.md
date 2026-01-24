# Error Handling & Toast Notifications

This document describes the error handling and toast notification system implemented in the Smart Apply frontend.

## Overview

The application uses a centralized error handling system with:

- **Sonner** for toast notifications
- **Custom error classes** for type-safe error handling
- **React Query** integration for automatic retry logic
- **Error boundaries** for React component errors
- **Automatic 401 handling** with redirect to login

## Components

### 1. Error Classes (`src/lib/errors.ts`)

#### `ApiError`

Custom error class for API errors with additional context:

```typescript
const error = new ApiError(404, 'Not Found', {
  message: 'User not found',
  statusCode: 404
});

// Check error type
if (ApiError.isApiError(error)) {
  console.log(error.status); // 404
}
```

#### `NetworkError`

Error class for network/connection issues:

```typescript
throw new NetworkError('Connection failed');
```

#### Utility Functions

- `getErrorMessage(error)` - Get user-friendly error message
- `shouldRetry(error, retryCount)` - Determine if request should retry
- `getRetryDelay(retryCount)` - Calculate exponential backoff delay

### 2. Toast Utilities (`src/lib/toast.ts`)

Convenient wrappers around Sonner with consistent styling:

```typescript
import { toastSuccess, toastError, toastWarning, toastInfo } from '@/lib/toast';

// Success toast
toastSuccess('Profile updated successfully');

// Error toast with automatic error message extraction
toastError(error, 'Failed to update profile');

// Warning toast
toastWarning('This action cannot be undone');

// Info toast
toastInfo('New features available');

// Error with retry action
toastErrorWithRetry(error, () => {
  // Retry logic
});

// Promise toast (auto loading/success/error states)
toastPromise(
  api.profile.update(token, data),
  {
    loading: 'Updating profile...',
    success: 'Profile updated!',
    error: 'Failed to update profile'
  }
);
```

### 3. Enhanced API Client (`src/lib/api-client.ts`)

The API client includes:

- **Automatic retry logic** for network errors and 5xx errors
- **Exponential backoff** between retries
- **Network error detection** and conversion to `NetworkError`
- **Type-safe error handling** with `ApiError`

```typescript
// Automatic retry for network errors (up to 3 times)
const data = await api.profile.get(token);

// Disable retry for specific request
const data = await apiRequest('/endpoint', {
  token,
  retry: false
});
```

### 4. Error Handling Hooks (`src/hooks/use-api-error.ts`)

#### `useApiError`

Hook to handle errors with automatic actions:

```typescript
const { data, error } = useQuery(['profile'], fetchProfile);

useApiError({
  error,
  autoRedirect: true, // Redirect to login on 401
  showToast: true,    // Show toast notification
  onError: (err) => {
    // Custom error handling
  }
});
```

#### `useErrorHandler`

Returns an error handler function for mutations:

```typescript
const handleError = useErrorHandler({
  autoRedirect: true,
  showToast: true,
  onError: (error) => {
    console.log('Custom error handling', error);
  },
});

const mutation = useMutation({
  mutationFn: updateProfile,
  onError: handleError,
});
```

### 5. React Query Global Error Handling (`src/lib/providers.tsx`)

React Query is configured with:

- **Automatic retry logic** for network errors and 5xx errors
- **No retry** for 4xx errors (client errors)
- **Global error handler** for mutations that handles 401 errors
- **Exponential backoff** retry delay

```typescript
// Configured in QueryClient
queries: {
  retry: (failureCount, error) => {
    // Don't retry 4xx errors
    if (ApiError.isApiError(error) && error.status >= 400 && error.status < 500) {
      return false;
    }
    return shouldRetry(error, failureCount, 3);
  },
  retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
}
```

### 6. Error Boundaries

#### Component Error Boundary (`src/components/error-boundary.tsx`)

React Error Boundary class component that catches JavaScript errors:

```typescript
<ErrorBoundary>
  <YourComponent />
</ErrorBoundary>
```

#### Next.js Error Boundary (`src/app/error.tsx`)

Next.js error boundary for app directory errors:

- Automatically wraps all pages
- Shows user-friendly error UI
- Provides "Try again" and "Go to dashboard" actions

## Error Scenarios Handled

### 1. Network Errors (No Connection)

- **Detection**: `TypeError: Failed to fetch`
- **Handling**: Automatic retry with exponential backoff
- **User Feedback**: Toast with retry button

### 2. 401 Unauthorized (Session Expired)

- **Detection**: `ApiError` with status 401
- **Handling**:
  - Clear auth state
  - Show "Session expired" toast
  - Redirect to login page
- **Applies to**: All API calls

### 3. 403 Forbidden

- **Detection**: `ApiError` with status 403
- **Handling**: Show "Access denied" message
- **No automatic action**

### 4. 404 Not Found

- **Detection**: `ApiError` with status 404
- **Handling**: Show "Resource not found" message
- **No retry**

### 5. 422 Validation Error

- **Detection**: `ApiError` with status 422
- **Handling**: Show validation error message from backend
- **No retry**

### 6. 429 Rate Limit

- **Detection**: `ApiError` with status 429
- **Handling**: Show "Too many requests" message
- **No retry** (should implement proper rate limiting)

### 7. 500 Server Error

- **Detection**: `ApiError` with status 500+
- **Handling**:
  - Automatic retry (up to 3 times)
  - Exponential backoff delay
  - Show error message if all retries fail

### 8. React Component Errors

- **Detection**: Error thrown in React component
- **Handling**:
  - Error Boundary catches error
  - Shows fallback UI
  - Prevents app crash
  - Provides reload option

## Usage Examples

### Example 1: Simple Mutation with Error Handling

```typescript
import { useMutation } from '@tanstack/react-query';
import { toastSuccess, toastError } from '@/lib/toast';

function MyComponent() {
  const mutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: () => {
      toastSuccess('Profile updated!');
    },
    onError: (error) => {
      toastError(error, 'Failed to update profile');
    },
  });
}
```

### Example 2: Using Error Handler Hook

```typescript
import { useMutation } from '@tanstack/react-query';
import { useErrorHandler } from '@/hooks/use-api-error';
import { toastSuccess } from '@/lib/toast';

function MyComponent() {
  const handleError = useErrorHandler();

  const mutation = useMutation({
    mutationFn: deleteItem,
    onSuccess: () => {
      toastSuccess('Item deleted!');
    },
    onError: handleError // Automatic 401 handling + toast
  });
}
```

### Example 3: Manual Error Handling in Component

```typescript
import { api } from '@/lib/api-client';
import { ApiError, getErrorMessage } from '@/lib/errors';
import { toastError } from '@/lib/toast';

async function handleSubmit(data: FormData) {
  try {
    await api.profile.update(token, data);
    toastSuccess('Success!');
  } catch (error) {
    if (ApiError.isApiError(error) && error.status === 422) {
      // Handle validation errors specifically
      toastError(error, 'Please check your input');
    } else {
      // Generic error handling
      toastError(error);
    }
  }
}
```

### Example 4: Network Error with Retry

```typescript
import { toastNetworkError } from '@/lib/toast';

function MyComponent() {
  const [retry, setRetry] = useState(0);

  const { data, error, refetch } = useQuery({
    queryKey: ['data', retry],
    queryFn: fetchData,
  });

  useEffect(() => {
    if (error && NetworkError.isNetworkError(error)) {
      toastNetworkError(() => {
        setRetry((prev) => prev + 1);
      });
    }
  }, [error]);
}
```

## Best Practices

1. **Use toast utilities** instead of calling `sonner.toast` directly
2. **Let React Query handle retries** for queries (don't implement manual retry in components)
3. **Use `useErrorHandler` hook** for consistent mutation error handling
4. **Handle 401 errors globally** (already done in providers)
5. **Show user-friendly messages** - use `getErrorMessage()` for consistent messaging
6. **Don't swallow errors** - always show feedback to users
7. **Log errors in production** to error tracking service (not implemented yet)

## Configuration

### Toast Duration

Default durations (can be overridden):

- Success: 4 seconds
- Error: 5 seconds
- Warning: 4 seconds
- Info: 4 seconds

### Retry Configuration

- **Max retries**: 3 attempts
- **Retry delay**: Exponential backoff (1s, 2s, 4s, 8s, max 10s)
- **Retry on**: Network errors, 5xx errors
- **Don't retry**: 4xx errors (client errors)

## Accessibility

All toasts include:

- **ARIA live regions** (handled by Sonner)
- **Close button** for manual dismissal
- **Auto-dismiss** after timeout
- **Keyboard navigation** support
- **Screen reader announcements**

## Future Improvements

1. **Error Tracking Integration** (Sentry, LogRocket)
   - Log all errors to tracking service
   - Include user context and breadcrumbs
2. **Offline Detection**
   - Show offline banner when no connection
   - Queue mutations for retry when back online
3. **Custom Error Pages**
   - 404 page
   - 500 page
   - Maintenance page
4. **Validation Error Details**
   - Show field-specific validation errors
   - Highlight invalid form fields
5. **Rate Limiting UI**
   - Show rate limit status
   - Display countdown until retry allowed

## Testing

To test error handling:

```bash
# Start dev server
npm run dev

# Simulate errors in browser console:
# 1. Network error - disconnect network
# 2. 401 error - delete auth token from localStorage
# 3. 500 error - modify API to throw error
# 4. React error - throw error in component
```

## Related Files

- `src/lib/errors.ts` - Error classes and utilities
- `src/lib/toast.ts` - Toast notification helpers
- `src/lib/api-client.ts` - Enhanced API client
- `src/lib/providers.tsx` - React Query configuration
- `src/hooks/use-api-error.ts` - Error handling hooks
- `src/components/error-boundary.tsx` - Error Boundary component
- `src/app/error.tsx` - Next.js error boundary
- `src/hooks/use-profile.ts` - Example usage in hooks
- `src/app/(auth)/login/page.tsx` - Example usage in pages
