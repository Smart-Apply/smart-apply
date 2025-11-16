/**
 * API Client for Smart Apply Backend
 * Base URL: http://localhost:3000/api/v1
 */

import type { User, Profile, JobPosting, Application, UpdateProfileDto, ApplicationFilesResponse } from '@/types';
import { ApiError, NetworkError, shouldRetry, getRetryDelay } from './errors';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

interface RequestOptions extends RequestInit {
  retry?: boolean;
  maxRetries?: number;
}

/**
 * Generic fetch wrapper with error handling and retry logic
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { retry = true, maxRetries = 3, ...fetchOptions } = options;
  let retryCount = 0;

  const makeRequest = async (): Promise<T> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(fetchOptions.headers as Record<string, string>),
    };

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...fetchOptions,
        headers,
        credentials: 'include', // Include cookies with requests
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
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
      apiRequest<{ message: string }>('/auth/logout', {
        method: 'POST',
      }),

    me: () =>
      apiRequest<User>('/auth/me'),
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

    list: () =>
      apiRequest<Application[]>('/applications'),

    getById: (id: string) =>
      apiRequest<Application>(`/applications/${id}`),

    getFiles: (id: string) =>
      apiRequest<ApplicationFilesResponse>(`/applications/${id}/files`),
  },
};
