/**
 * Toast notification utilities for Smart Apply
 * Provides consistent toast API across the application
 */

import { toast as sonnerToast } from 'sonner';
import { getErrorMessage } from './errors';
export const toast = sonnerToast;

/**
 * Toast options for customization
 */
interface ToastOptions {
  duration?: number;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * Show success toast
 */
export function toastSuccess(message: string, options?: ToastOptions) {
  sonnerToast.success(message, {
    duration: options?.duration || 4000,
    description: options?.description,
    action: options?.action,
  });
}

/**
 * Show error toast with proper error handling
 */
export function toastError(error: unknown, fallbackMessage?: string, options?: ToastOptions) {
  const message = fallbackMessage || getErrorMessage(error);
  
  sonnerToast.error(message, {
    duration: options?.duration || 5000,
    description: options?.description,
    action: options?.action,
  });
}

/**
 * Show warning toast
 */
export function toastWarning(message: string, options?: ToastOptions) {
  sonnerToast.warning(message, {
    duration: options?.duration || 4000,
    description: options?.description,
    action: options?.action,
  });
}

/**
 * Show info toast
 */
export function toastInfo(message: string, options?: ToastOptions) {
  sonnerToast.info(message, {
    duration: options?.duration || 4000,
    description: options?.description,
    action: options?.action,
  });
}

/**
 * Show loading toast (for long operations)
 */
export function toastLoading(message: string) {
  return sonnerToast.loading(message);
}

/**
 * Dismiss a specific toast or all toasts
 */
export function toastDismiss(toastId?: string | number) {
  sonnerToast.dismiss(toastId);
}

/**
 * Show promise toast (automatically handles loading, success, error states)
 */
export function toastPromise<T>(
  promise: Promise<T>,
  messages: {
    loading: string;
    success: string | ((data: T) => string);
    error: string | ((error: unknown) => string);
  }
): void {
  sonnerToast.promise(promise, {
    loading: messages.loading,
    success: (data) => {
      return typeof messages.success === 'function'
        ? messages.success(data)
        : messages.success;
    },
    error: (error) => {
      return typeof messages.error === 'function'
        ? messages.error(error)
        : getErrorMessage(error);
    },
  });
}

/**
 * Show error with retry action
 */
export function toastErrorWithRetry(
  error: unknown,
  onRetry: () => void,
  fallbackMessage?: string,
  retryLabel: string = 'Wiederholen'
) {
  const message = fallbackMessage || getErrorMessage(error);
  
  sonnerToast.error(message, {
    duration: 6000,
    action: {
      label: retryLabel,
      onClick: onRetry,
    },
  });
}

/**
 * Show network error with retry
 */
export function toastNetworkError(onRetry: () => void, retryLabel?: string) {
  toastErrorWithRetry(
    new Error('Network error'),
    onRetry,
    'Netzwerkfehler. Bitte überprüfe deine Internetverbindung.',
    retryLabel
  );
}

/**
 * Show validation error toast
 */
export function toastValidationError(errors: Record<string, string[]>) {
  const firstError = Object.values(errors)[0]?.[0];
  if (firstError) {
    toastError(
      new Error(firstError),
      'Validierungsfehler',
      {
        description: 'Bitte überprüfe deine Eingaben.',
      }
    );
  }
}
