'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Toaster } from 'sonner';
import { ApiError, ErrorType, shouldRetry } from './errors';
import { toastError } from './toast';
import { useAuthStore } from '@/stores/auth-store';
import { fetchCsrfToken } from './csrf';

/**
 * Global error handler for React Query
 */
function useQueryErrorHandler() {
  const router = useRouter();
  const clearAuth = useAuthStore((state) => state.clearAuth);

  return (error: unknown) => {
    // Handle 401 Unauthorized - logout and redirect
    if (ApiError.isApiError(error) && error.status === ErrorType.UNAUTHORIZED) {
      clearAuth();
      toastError(error, 'Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.');
      router.push('/login');
      return;
    }

    // Don't show toast for every query error (components handle their own errors)
    // This is just for critical errors that need immediate attention
  };
}

export function Providers({ children }: { children: React.ReactNode }) {
  const handleError = useQueryErrorHandler();

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            retry: (failureCount, error) => {
              // Don't retry on 4xx errors (except network errors)
              if (ApiError.isApiError(error) && error.status >= 400 && error.status < 500) {
                return false;
              }
              // Retry on network errors and 5xx errors
              return shouldRetry(error, failureCount, 3);
            },
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
          },
          mutations: {
            onError: handleError,
          },
        },
      })
  );

  // Initialize CSRF token on app load (silently fail if backend is not available)
  useEffect(() => {
    fetchCsrfToken().catch((error) => {
      // Silently ignore CSRF fetch errors during development
      // (backend might not be running yet)
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️  Backend not reachable, skipping CSRF token fetch');
      } else {
        console.error('Failed to initialize CSRF token:', error);
      }
    });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster 
        position="top-right" 
        richColors 
        closeButton
        duration={4000}
        toastOptions={{
          className: 'sonner-toast',
        }}
      />
    </QueryClientProvider>
  );
}
