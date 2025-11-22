/**
 * API Client for Smart Apply Backend
 * Base URL: http://localhost:3000/api/v1
 */

import type {
  User,
  Profile,
  JobPosting,
  Application,
  UpdateProfileDto,
  ApplicationFilesResponse,
  ApplicationStatusResponse,
  ApplicationTrackingStatus,
  ResumeData,
} from '@/types';
import { ApiError, NetworkError, shouldRetry, getRetryDelay, isPermanentAuthFailure } from './errors';
import { getCsrfToken, refreshCsrfToken } from './csrf';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

interface RequestOptions extends RequestInit {
  retry?: boolean;
  maxRetries?: number;
}

// Track if a refresh is already in progress to prevent concurrent refresh requests
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

/**
 * Refresh access token using refresh token
 * Uses singleton pattern to prevent concurrent refresh requests
 */
async function refreshAccessToken(): Promise<boolean> {
  // If already refreshing, return the existing promise
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  // Start new refresh
  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include', // Send refresh token cookie
      });

      if (!response.ok) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('Failed to refresh token:', error);
      return false;
    } finally {
      // Reset refresh state after a short delay to allow token propagation
      setTimeout(() => {
        isRefreshing = false;
        refreshPromise = null;
      }, 100);
    }
  })();

  return refreshPromise;
}

/**
 * Generic fetch wrapper with error handling, retry logic, and automatic token refresh
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { retry = true, maxRetries = 3, ...fetchOptions } = options;
  let retryCount = 0;

  const makeRequest = async (isRetryAfterRefresh = false): Promise<T> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(fetchOptions.headers as Record<string, string>),
    };

    // Include CSRF token for state-changing requests (POST, PUT, DELETE, PATCH)
    const method = fetchOptions.method?.toUpperCase() || 'GET';
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
      const csrfToken = getCsrfToken();
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }
    }

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...fetchOptions,
        headers,
        credentials: 'include', // Include cookies with requests
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        
        // Handle CSRF token errors (403 Forbidden with CSRF error)
        if (response.status === 403 && errorData?.code === 'EBADCSRFTOKEN') {
          // Refresh CSRF token and retry ONCE (only if not already retried)
          if (!isRetryAfterRefresh) {
            await refreshCsrfToken();
            return makeRequest(true); // Retry with new CSRF token
          }
          // If already retried, throw error (don't retry infinitely)
          throw new ApiError(response.status, 'CSRF token invalid or expired after retry.', errorData);
        }

        // Handle 401 Unauthorized
        if (response.status === 401) {
          // Check for permanent authentication failures (user/token deleted from DB)
          // These should NOT trigger token refresh attempts
          const errorMessage = errorData?.message || '';
          const isPermAuthFailure = 
            errorMessage.includes('User not found') ||
            errorMessage.includes('Refresh token not found') ||
            errorMessage.includes('token not found or revoked');
          
          if (isPermAuthFailure) {
            // User or tokens were deleted from database - redirect to login immediately
            // Don't attempt refresh (it will fail anyway and cause retry loops)
            if (typeof window !== 'undefined') {
              console.warn('Authentication data invalid (user/token deleted). Redirecting to login...');
              window.location.href = '/login?session_expired=true';
            }
            throw new ApiError(response.status, response.statusText, errorData);
          }
          
          // For other 401 errors, attempt token refresh (only once)
          if (!isRetryAfterRefresh) {
            // Don't try to refresh on auth endpoints or refresh endpoint itself
            const isAuthEndpoint = endpoint.startsWith('/auth/login') || 
                                   endpoint.startsWith('/auth/register') ||
                                   endpoint.startsWith('/auth/refresh');
            
            if (!isAuthEndpoint) {
              // Try to refresh the token
              const refreshed = await refreshAccessToken();
              
              if (refreshed) {
                // Retry the original request with new access token
                return makeRequest(true);
              } else {
                // Refresh failed, redirect to login
                if (typeof window !== 'undefined') {
                  window.location.href = '/login?session_expired=true';
                }
              }
            }
          }
        }
        
        throw new ApiError(response.status, response.statusText, errorData);
      }

      // Handle 204 No Content
      if (response.status === 204) {
        return {} as T;
      }

      return response.json();
    } catch (error) {
      // Convert network errors to NetworkError
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        throw new NetworkError();
      }
      throw error;
    }
  };

  // Retry logic
  while (true) {
    try {
      return await makeRequest();
    } catch (error) {
      // Never retry permanent authentication failures (user/token deleted)
      // They will never succeed and cause infinite loops
      if (isPermanentAuthFailure(error)) {
        throw error;
      }
      
      if (retry && shouldRetry(error, retryCount, maxRetries)) {
        retryCount++;
        const delay = getRetryDelay(retryCount);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
}

/**
 * API Client methods
 */
export const api = {
  // Auth
  auth: {
    register: (data: { email: string; password: string; firstName: string; lastName: string }) =>
      apiRequest<{ user: User }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    login: (data: { email: string; password: string }) =>
      apiRequest<{ user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    logout: () =>
      apiRequest<{ message: string }>('/auth/logout'),
      // GET request (no method specified = GET), no CSRF token required

    me: () =>
      apiRequest<User>('/auth/me'),

    getCsrfToken: () =>
      apiRequest<{ csrfToken: string; message: string }>('/auth/csrf-token'),
  },

  // Profile
  profile: {
    get: () =>
      apiRequest<Profile>('/profile'),

    update: (data: UpdateProfileDto) =>
      apiRequest<Profile>('/profile', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
  },

  // Job Postings
  jobPostings: {
    parse: (data: { text?: string; url?: string; fileId?: string }) =>
      apiRequest<JobPosting>('/job-postings/parse', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    list: () =>
      apiRequest<JobPosting[]>('/job-postings'),

    getById: (id: string) =>
      apiRequest<JobPosting>(`/job-postings/${id}`),

    delete: (id: string) =>
      apiRequest<void>(`/job-postings/${id}`, {
        method: 'DELETE',
      }),
  },

  // Applications
  applications: {
    create: (data: { jobPostingId: string }) =>
      apiRequest<Application>('/applications', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    createWithGeneration: (data: { jobPostingId: string }) =>
      apiRequest<Application>('/applications/create-with-generation', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    list: () =>
      apiRequest<Application[]>('/applications'),

    getById: (id: string) =>
      apiRequest<Application>(`/applications/${id}`),

    getStatus: (id: string) =>
      apiRequest<ApplicationStatusResponse>(`/applications/${id}/status`),

    getFiles: (id: string) =>
      apiRequest<ApplicationFilesResponse>(`/applications/${id}/files`),

    delete: (id: string) =>
      apiRequest<void>(`/applications/${id}`, {
        method: 'DELETE',
      }),

    updateResume: (id: string, data: { resume: ResumeData }) =>
      apiRequest<Application>(`/applications/${id}/resume`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    upsertCoverLetter: (id: string, data: { instructions?: string; content?: string; regenerate?: boolean }) =>
      apiRequest<Application>(`/applications/${id}/cover-letter`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    export: (id: string) =>
      apiRequest<Application>(`/applications/${id}/export`, {
        method: 'POST',
      }),

    updateStatus: (id: string, status: ApplicationTrackingStatus) =>
      apiRequest<Application>(`/applications/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),

    updateTitle: (id: string, title: string) =>
      apiRequest<Application>(`/applications/${id}/title`, {
        method: 'PATCH',
        body: JSON.stringify({ title }),
      }),
  },
};
