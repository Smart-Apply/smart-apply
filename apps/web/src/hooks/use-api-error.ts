/**
 * Custom hook for handling API errors with automatic actions
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { ApiError, ErrorType } from '@/lib/errors';
import { toastError } from '@/lib/toast';

interface UseApiErrorOptions {
  error: unknown;
  onError?: (error: unknown) => void;
  autoRedirect?: boolean; // Auto redirect to login on 401
  showToast?: boolean; // Auto show toast on error
}

/**
 * Hook to handle API errors with automatic actions
 * - Shows toast notifications
 * - Redirects to login on 401 Unauthorized
 * - Custom error handlers
 */
export function useApiError(options: UseApiErrorOptions) {
  const { error, onError, autoRedirect = true, showToast = true } = options;
  const router = useRouter();
  const clearAuth = useAuthStore((state) => state.clearAuth);

  useEffect(() => {
    if (!error) return;

    // Handle 401 Unauthorized - logout and redirect to login
    if (ApiError.isApiError(error) && error.status === ErrorType.UNAUTHORIZED && autoRedirect) {
      clearAuth();
      toastError(error, 'Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.');
      router.push('/login');
      return;
    }

    // Show toast notification
    if (showToast) {
      toastError(error);
    }

    // Call custom error handler
    if (onError) {
      onError(error);
    }
  }, [error, onError, autoRedirect, showToast, router, clearAuth]);
}

/**
 * Hook to handle errors in mutations
 * Returns an error handler function to use in mutation callbacks
 */
export function useErrorHandler(options?: {
  autoRedirect?: boolean;
  showToast?: boolean;
  onError?: (error: unknown) => void;
}) {
  const router = useRouter();
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const { autoRedirect = true, showToast = true, onError } = options || {};

  return (error: unknown) => {
    // Handle 401 Unauthorized
    if (ApiError.isApiError(error) && error.status === ErrorType.UNAUTHORIZED && autoRedirect) {
      clearAuth();
      toastError(error, 'Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.');
      router.push('/login');
      return;
    }

    // Show toast
    if (showToast) {
      toastError(error);
    }

    // Call custom handler
    if (onError) {
      onError(error);
    }
  };
}
