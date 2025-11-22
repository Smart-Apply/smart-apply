/**
 * Error handling utilities for Smart Apply
 */

/**
 * Custom API Error class with additional context
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public data?: {
      message?: string;
      error?: string;
      statusCode?: number;
    }
  ) {
    super(data?.message || `API Error: ${status} ${statusText}`);
    this.name = 'ApiError';
  }

  /**
   * Check if error is a specific HTTP status
   */
  isStatus(code: number): boolean {
    return this.status === code;
  }

  /**
   * Check if error is a network error
   */
  static isNetworkError(error: unknown): boolean {
    return error instanceof TypeError && error.message === 'Failed to fetch';
  }

  /**
   * Check if error is an ApiError
   */
  static isApiError(error: unknown): error is ApiError {
    return error instanceof ApiError;
  }
}

/**
 * Network error class for connection issues
 */
export class NetworkError extends Error {
  constructor(message = 'Netzwerkfehler. Bitte überprüfe deine Internetverbindung.') {
    super(message);
    this.name = 'NetworkError';
  }
}

/**
 * Error type definitions for better type safety
 */
export enum ErrorType {
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  VALIDATION = 422,
  RATE_LIMIT = 429,
  SERVER_ERROR = 500,
  NETWORK = 'network',
}

/**
 * Get user-friendly error message based on error type
 */
export function getErrorMessage(error: unknown): string {
  // Network errors
  if (error instanceof NetworkError || (error instanceof TypeError && error.message === 'Failed to fetch')) {
    return 'Netzwerkfehler. Bitte überprüfe deine Internetverbindung.';
  }

  // API errors
  if (ApiError.isApiError(error)) {
    // Use backend error message if available
    if (error.data?.message) {
      return error.data.message;
    }

    // Default messages based on status code
    switch (error.status) {
      case ErrorType.UNAUTHORIZED:
        return 'Nicht autorisiert. Bitte melde dich erneut an.';
      case ErrorType.FORBIDDEN:
        return 'Zugriff verweigert. Du hast keine Berechtigung für diese Aktion.';
      case ErrorType.NOT_FOUND:
        return 'Die angeforderte Ressource wurde nicht gefunden.';
      case ErrorType.VALIDATION:
        return 'Ungültige Eingabe. Bitte überprüfe deine Daten.';
      case ErrorType.RATE_LIMIT:
        return 'Zu viele Anfragen. Bitte versuche es später erneut.';
      case ErrorType.SERVER_ERROR:
        return 'Ein Serverfehler ist aufgetreten. Bitte versuche es später erneut.';
      default:
        return `Ein Fehler ist aufgetreten: ${error.statusText}`;
    }
  }

  // Generic error
  if (error instanceof Error) {
    return error.message;
  }

  return 'Ein unbekannter Fehler ist aufgetreten.';
}

/**
 * Check if error is a permanent authentication failure (user/token deleted)
 * These errors should NOT trigger retries as they will never succeed
 */
export function isPermanentAuthFailure(error: unknown): boolean {
  if (!ApiError.isApiError(error) || error.status !== 401) {
    return false;
  }
  
  const message = error.data?.message || error.message || '';
  return (
    message.includes('User not found') ||
    message.includes('Refresh token not found') ||
    message.includes('token not found or revoked')
  );
}

/**
 * Check if error should trigger retry
 */
export function shouldRetry(error: unknown, retryCount: number, maxRetries = 3): boolean {
  if (retryCount >= maxRetries) {
    return false;
  }

  // Retry on network errors
  if (error instanceof NetworkError || (error instanceof TypeError && error.message === 'Failed to fetch')) {
    return true;
  }

  // Retry on server errors (500-599)
  if (ApiError.isApiError(error) && error.status >= 500) {
    return true;
  }

  return false;
}

/**
 * Calculate exponential backoff delay
 */
export function getRetryDelay(retryCount: number): number {
  // Exponential backoff: 1s, 2s, 4s, 8s, etc.
  return Math.min(1000 * Math.pow(2, retryCount), 10000);
}
