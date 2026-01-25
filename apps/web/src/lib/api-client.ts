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
  SessionsResponse,
  Template,
  TemplateWithContent,
  ApplicationKeywordsResponse,
  UserPreferences,
  UpdateUserPreferencesDto,
  PaginatedResponse,
  ExtractedProfile,
  SubscriptionTier,
  SubscriptionUsageStats,
  TierLimits,
  TiersResponse,
  CanPerformActionResult,
} from '@/types';
import {
  ApiError,
  NetworkError,
  shouldRetry,
  getRetryDelay,
  isPermanentAuthFailure,
} from './errors';
import { getCsrfToken, refreshCsrfToken } from './csrf';
import { getApiBaseUrl } from './config';

interface RequestOptions extends RequestInit {
  retry?: boolean;
  maxRetries?: number;
}

// Track if a refresh is already in progress to prevent concurrent refresh requests
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

// Track if we're already redirecting to login to prevent multiple redirects
let isRedirectingToLogin = false;

/**
 * Clear auth state and redirect to login
 * Uses a flag to prevent multiple redirects from concurrent requests
 */
function handleAuthFailure(): never {
  if (typeof window !== 'undefined' && !isRedirectingToLogin) {
    isRedirectingToLogin = true;

    // Clear auth store to prevent further authenticated requests
    // This also disables queries that depend on isAuthenticated
    import('@/stores/auth-store')
      .then(({ useAuthStore }) => {
        useAuthStore.getState().clearAuth();
      })
      .catch(console.error);

    console.warn('Authentication failed. Redirecting to login...');
    window.location.href = '/login?session_expired=true';
  }

  // Throw error to stop further processing in the request chain
  throw new ApiError(401, 'Unauthorized', { message: 'Session expired. Redirecting to login...' });
}

/**
 * Refresh access token using refresh token
 * Uses singleton pattern to prevent concurrent refresh requests
 */
async function refreshAccessToken(): Promise<boolean> {
  // If already redirecting, don't bother refreshing
  if (isRedirectingToLogin) {
    return false;
  }

  // If already refreshing, return the existing promise
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  // Start new refresh
  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const baseUrl = await getApiBaseUrl();
      const response = await fetch(`${baseUrl}/auth/refresh`, {
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
async function apiRequest<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
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
      const baseUrl = await getApiBaseUrl();
      const response = await fetch(`${baseUrl}${endpoint}`, {
        ...fetchOptions,
        headers,
        credentials: 'include', // Include cookies with requests
      });

      // Extract and handle rate limit headers
      const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining');
      const rateLimitReset = response.headers.get('X-RateLimit-Reset');
      const rateLimitLimit = response.headers.get('X-RateLimit-Limit');

      // Warn user if close to rate limit (less than 10 requests remaining)
      if (
        rateLimitRemaining &&
        rateLimitLimit &&
        parseInt(rateLimitRemaining) < 10 &&
        parseInt(rateLimitRemaining) > 0
      ) {
        const resetTime = rateLimitReset ? parseInt(rateLimitReset) : Date.now();
        const minutesUntilReset = Math.ceil((resetTime - Date.now()) / 60000);

        // Only show toast on client side
        if (typeof window !== 'undefined') {
          const { toast } = await import('sonner');
          toast.warning(
            `Nur noch ${rateLimitRemaining} Aktionen verfügbar. ` +
              `Limit wird zurückgesetzt in ${minutesUntilReset} Minute${minutesUntilReset !== 1 ? 'n' : ''}.`,
          );
        }
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);

        // Handle rate limit errors (429 Too Many Requests)
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          const retrySeconds = retryAfter ? parseInt(retryAfter) : 60;
          const retryMinutes = Math.ceil(retrySeconds / 60);

          throw new ApiError(
            429,
            `Zu viele Aktionen. Bitte warte ${retryMinutes} Minute${retryMinutes !== 1 ? 'n' : ''} und versuche es erneut.`,
            errorData,
          );
        }

        // Handle CSRF token errors (403 Forbidden with CSRF error)
        if (response.status === 403 && errorData?.code === 'EBADCSRFTOKEN') {
          // Refresh CSRF token and retry ONCE (only if not already retried)
          if (!isRetryAfterRefresh) {
            await refreshCsrfToken();
            return makeRequest(true); // Retry with new CSRF token
          }
          // If already retried, throw error (don't retry infinitely)
          throw new ApiError(
            response.status,
            'CSRF token invalid or expired after retry.',
            errorData,
          );
        }

        // Handle 401 Unauthorized
        if (response.status === 401) {
          // If we're already redirecting, throw immediately to stop further processing
          if (isRedirectingToLogin) {
            throw new ApiError(response.status, 'Unauthorized', {
              message: 'Redirecting to login...',
            });
          }

          // Check for permanent authentication failures (user/token deleted from DB)
          // These should NOT trigger token refresh attempts
          const errorMessage = errorData?.message || '';
          const isPermAuthFailure =
            errorMessage.includes('User not found') ||
            errorMessage.includes('Refresh token not found') ||
            errorMessage.includes('token not found or revoked');

          if (isPermAuthFailure) {
            // User or tokens were deleted from database - redirect to login immediately
            handleAuthFailure();
          }

          // For other 401 errors, attempt token refresh (only once)
          if (!isRetryAfterRefresh) {
            // Don't try to refresh on auth endpoints or refresh endpoint itself
            const isAuthEndpoint =
              endpoint.startsWith('/auth/login') ||
              endpoint.startsWith('/auth/register') ||
              endpoint.startsWith('/auth/refresh');

            if (!isAuthEndpoint) {
              // Try to refresh the token
              const refreshed = await refreshAccessToken();

              if (refreshed) {
                // Retry the original request with new access token
                return makeRequest(true);
              } else {
                // Refresh failed, clear auth and redirect to login
                handleAuthFailure();
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

      // Parse JSON response
      const json = await response.json();

      // Unwrap standardized API response format { data, meta }
      // All endpoints now return this format (except 204 No Content)
      if (json && typeof json === 'object' && 'data' in json && 'meta' in json) {
        return json.data as T;
      }

      // Fallback for backward compatibility (shouldn't happen after migration)
      return json as T;
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
 * Reset the redirect flag - should be called after successful login
 * This allows the user to log in again after a session expiry redirect
 */
export function resetAuthRedirectFlag(): void {
  isRedirectingToLogin = false;
}

/**
 * Generic fetch wrapper for FormData (multipart/form-data) requests
 * Does NOT set Content-Type header (browser sets it with boundary automatically)
 */
async function apiRequestFormData<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { retry = true, maxRetries = 3, ...fetchOptions } = options;

  const makeRequest = async (isRetryAfterRefresh = false): Promise<T> => {
    const headers: Record<string, string> = {
      // Do NOT set Content-Type for FormData - browser sets it automatically with boundary
      ...(fetchOptions.headers as Record<string, string>),
    };
    // Remove Content-Type if accidentally set
    delete headers['Content-Type'];

    // Include CSRF token for state-changing requests
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
    }

    try {
      const baseUrl = await getApiBaseUrl();
      const response = await fetch(`${baseUrl}${endpoint}`, {
        ...fetchOptions,
        headers,
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);

        // Handle rate limit errors (429 Too Many Requests)
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          const retrySeconds = retryAfter ? parseInt(retryAfter) : 3600; // Default 1 hour for resume-parser
          const retryMinutes = Math.ceil(retrySeconds / 60);

          throw new ApiError(
            429,
            `Zu viele Uploads. Du kannst maximal 10 Lebensläufe pro Stunde analysieren. Bitte warte ${retryMinutes} Minute${retryMinutes !== 1 ? 'n' : ''}.`,
            errorData,
          );
        }

        // Handle CSRF token errors
        if (response.status === 403 && errorData?.code === 'EBADCSRFTOKEN') {
          if (!isRetryAfterRefresh) {
            await refreshCsrfToken();
            return makeRequest(true);
          }
          throw new ApiError(
            response.status,
            'CSRF token invalid or expired after retry.',
            errorData,
          );
        }

        // Handle 401 Unauthorized
        if (response.status === 401) {
          if (isRedirectingToLogin) {
            throw new ApiError(response.status, 'Unauthorized', {
              message: 'Redirecting to login...',
            });
          }

          const errorMessage = errorData?.message || '';
          if (isPermanentAuthFailure(errorMessage)) {
            handleAuthFailure();
          }

          if (!isRetryAfterRefresh) {
            const refreshed = await refreshAccessToken();
            if (refreshed) {
              return makeRequest(true);
            }
          }

          handleAuthFailure();
        }

        throw new ApiError(
          response.status,
          errorData?.message || 'Ein Fehler ist aufgetreten',
          errorData,
        );
      }

      // Parse JSON response
      const json = await response.json();

      // Unwrap standardized API response format { data, meta }
      if (json && typeof json === 'object' && 'data' in json && 'meta' in json) {
        return json.data as T;
      }

      // Fallback for backward compatibility
      return json as T;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new NetworkError('Netzwerkfehler. Bitte überprüfe deine Internetverbindung.');
    }
  };

  return makeRequest();
}

/**
 * Authenticated fetch wrapper for non-JSON requests (e.g., PDF downloads, blob fetches)
 * Handles automatic token refresh on 401 errors
 *
 * Use this instead of raw fetch() for any authenticated endpoint that doesn't return JSON
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const makeRequest = async (isRetryAfterRefresh = false): Promise<Response> => {
    const response = await fetch(url, {
      ...options,
      credentials: 'include', // Always include cookies
    });

    // Handle 401 Unauthorized with automatic token refresh
    if (response.status === 401 && !isRetryAfterRefresh) {
      // Don't try to refresh if already redirecting
      if (isRedirectingToLogin) {
        throw new Error('Session expired. Redirecting to login...');
      }

      // Try to refresh the token
      const refreshed = await refreshAccessToken();

      if (refreshed) {
        // Retry the original request with new access token
        return makeRequest(true);
      } else {
        // Refresh failed, clear auth and redirect to login
        handleAuthFailure();
      }
    }

    return response;
  };

  return makeRequest();
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

    logout: () => apiRequest<{ message: string }>('/auth/logout'),
    // GET request (no method specified = GET), no CSRF token required

    me: () => apiRequest<User>('/auth/me'),

    getCsrfToken: () => apiRequest<{ csrfToken: string; message: string }>('/auth/csrf-token'),

    updateProfile: (data: { firstName?: string; lastName?: string }) =>
      apiRequest<User>('/auth/profile', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    changePassword: (data: { currentPassword: string; newPassword: string }) =>
      apiRequest<{ message: string }>('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    deleteAccount: (data: { password: string }) =>
      apiRequest<{ message: string }>('/auth/account', {
        method: 'DELETE',
        body: JSON.stringify(data),
      }),
  },

  // User Preferences
  userPreferences: {
    get: () => apiRequest<UserPreferences>('/user-preferences'),

    update: (data: UpdateUserPreferencesDto) =>
      apiRequest<UserPreferences>('/user-preferences', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
  },

  // Profile
  profile: {
    get: () => apiRequest<Profile>('/profile'),

    update: (data: UpdateProfileDto) =>
      apiRequest<Profile>('/profile', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    parseResume: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return apiRequestFormData<ExtractedProfile>('/profile/parse-resume', {
        method: 'POST',
        body: formData,
      });
    },
  },

  // Job Postings
  jobPostings: {
    create: (data: {
      title: string;
      company: string;
      location?: string;
      url?: string;
      description: string;
      requirements?: string[];
      responsibilities?: string[];
      niceToHave?: string[];
      salary?: string;
      employmentType?: string;
    }) =>
      apiRequest<JobPosting>('/job-postings', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    parse: (data: { text?: string; url?: string; fileId?: string }) =>
      apiRequest<JobPosting>('/job-postings/parse', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    list: () => apiRequest<PaginatedResponse<JobPosting>>('/job-postings'),

    getById: (id: string) => apiRequest<JobPosting>(`/job-postings/${id}`),

    delete: (id: string) =>
      apiRequest<void>(`/job-postings/${id}`, {
        method: 'DELETE',
      }),
  },

  // Templates
  templates: {
    list: (type?: 'COVER_LETTER' | 'RESUME' | 'BOTH') =>
      apiRequest<Template[]>(`/templates${type ? `?type=${type}` : ''}`),

    getById: (id: string) => apiRequest<TemplateWithContent>(`/templates/${id}`),
  },

  // Applications
  applications: {
    create: (data: {
      jobPostingId: string;
      coverLetterTemplateId?: string;
      resumeTemplateId?: string;
      generateCoverLetter?: boolean;
    }) =>
      apiRequest<Application>('/applications', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    createWithGeneration: (data: {
      jobPostingId: string;
      coverLetterTemplateId?: string;
      resumeTemplateId?: string;
      generateCoverLetter?: boolean;
      language?: string;
    }) =>
      apiRequest<Application>('/applications/create-with-generation', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    list: (options?: { includeJobPosting?: boolean }) =>
      apiRequest<PaginatedResponse<Application>>(
        `/applications${options?.includeJobPosting ? '?includeJobPosting=true' : ''}`,
      ),

    getById: (id: string) => apiRequest<Application>(`/applications/${id}`),

    getStatus: (id: string) => apiRequest<ApplicationStatusResponse>(`/applications/${id}/status`),

    getFiles: (id: string) => apiRequest<ApplicationFilesResponse>(`/applications/${id}/files`),

    delete: (id: string) =>
      apiRequest<void>(`/applications/${id}`, {
        method: 'DELETE',
      }),

    updateResume: (id: string, data: { resume: ResumeData; contentLanguage?: string }) =>
      apiRequest<Application>(`/applications/${id}/resume`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    upsertCoverLetter: (
      id: string,
      data: { instructions?: string; content?: string; regenerate?: boolean },
    ) =>
      apiRequest<Application>(`/applications/${id}/cover-letter`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    generateSummary: (
      id: string,
      data: { instructions: string; currentSummary?: string; regenerate?: boolean },
    ) =>
      apiRequest<{ summary: string }>(`/applications/${id}/summary`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    generateExperienceDescription: (
      id: string,
      data: {
        instructions: string;
        experienceIndex: number;
        currentDescription?: string;
        experienceTitle: string;
        experienceCompany: string;
        experienceDateRange?: string;
        regenerate?: boolean;
      },
    ) =>
      apiRequest<{ description: string }>(`/applications/${id}/experience-description`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    generateProjectDescription: (
      id: string,
      data: {
        instructions: string;
        projectIndex: number;
        currentDescription?: string;
        projectName: string;
        projectDate?: string;
        regenerate?: boolean;
      },
    ) =>
      apiRequest<{ description: string }>(`/applications/${id}/project-description`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    export: (id: string, language?: 'de' | 'en' | 'fr' | 'es' | 'it') =>
      apiRequest<Application>(`/applications/${id}/export`, {
        method: 'POST',
        body: language ? JSON.stringify({ language }) : undefined,
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

    updateTargetJobTitle: (id: string, targetJobTitle: string) =>
      apiRequest<Application>(`/applications/${id}/target-job-title`, {
        method: 'PATCH',
        body: JSON.stringify({ targetJobTitle }),
      }),

    regenerate: (id: string) =>
      apiRequest<Application>(`/applications/${id}/regenerate`, {
        method: 'POST',
      }),

    // ATS Keywords endpoints
    analyzeKeywords: (id: string) =>
      apiRequest<ApplicationKeywordsResponse>(`/applications/${id}/analyze-keywords`, {
        method: 'POST',
      }),

    getKeywordsAnalysis: (id: string) =>
      apiRequest<ApplicationKeywordsResponse>(`/applications/${id}/keywords`),
  },

  // Sessions
  sessions: {
    list: () => apiRequest<SessionsResponse>('/auth/sessions'),

    revoke: (sessionId: string) =>
      apiRequest<{ message: string }>(`/auth/sessions/${sessionId}`, {
        method: 'DELETE',
      }),

    revokeAll: () =>
      apiRequest<{ message: string; revokedCount: number }>('/auth/sessions', {
        method: 'DELETE',
      }),
  },

  // Subscription
  subscription: {
    get: () =>
      apiRequest<SubscriptionUsageStats>('/subscription'),

    getUsage: () =>
      apiRequest<{
        applications: { used: number; limit: number; remaining: number };
        interviewSessions: { used: number; limit: number; remaining: number };
        periodStart: string;
        periodEnd: string;
      }>('/subscription/usage'),

    getLimits: () =>
      apiRequest<{ tier: SubscriptionTier; limits: TierLimits }>('/subscription/limits'),

    getTiers: () =>
      apiRequest<TiersResponse>('/subscription/tiers'),

    canPerform: (action: 'application' | 'interview') =>
      apiRequest<CanPerformActionResult>(`/subscription/can-perform/${action}`),
  },
};
