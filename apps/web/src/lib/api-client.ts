/**
 * API Client for Smart Apply Backend
 * Base URL: http://localhost:3000/api/v1
 */

import type { User, Profile, JobPosting, Application, UpdateProfileDto } from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public data?: unknown
  ) {
    super(`API Error: ${status} ${statusText}`);
    this.name = 'ApiError';
  }
}

interface RequestOptions extends RequestInit {
  token?: string;
}

/**
 * Generic fetch wrapper with error handling
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { token, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...fetchOptions,
    headers,
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
}

/**
 * API Client methods
 */
export const api = {
  // Auth
  auth: {
    register: (data: { email: string; password: string; name: string }) =>
      apiRequest<{ accessToken: string; user: User }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    login: (data: { email: string; password: string }) =>
      apiRequest<{ accessToken: string; user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    me: (token: string) =>
      apiRequest<User>('/auth/me', {
        token,
      }),
  },

  // Profile
  profile: {
    get: (token: string) =>
      apiRequest<Profile>('/profile', { token }),

    update: (token: string, data: UpdateProfileDto) =>
      apiRequest<Profile>('/profile', {
        method: 'PUT',
        token,
        body: JSON.stringify(data),
      }),
  },

  // Job Postings
  jobPostings: {
    parse: (token: string, data: { text?: string; url?: string; fileId?: string }) =>
      apiRequest<JobPosting>('/job-postings/parse', {
        method: 'POST',
        token,
        body: JSON.stringify(data),
      }),

    list: (token: string) =>
      apiRequest<JobPosting[]>('/job-postings', { token }),

    getById: (token: string, id: string) =>
      apiRequest<JobPosting>(`/job-postings/${id}`, { token }),

    delete: (token: string, id: string) =>
      apiRequest<void>(`/job-postings/${id}`, {
        method: 'DELETE',
        token,
      }),
  },

  // Applications
  applications: {
    create: (token: string, data: { jobPostingId: string }) =>
      apiRequest<Application>('/applications', {
        method: 'POST',
        token,
        body: JSON.stringify(data),
      }),

    list: (token: string) =>
      apiRequest<Application[]>('/applications', { token }),

    getById: (token: string, id: string) =>
      apiRequest<Application>(`/applications/${id}`, { token }),

    getFiles: (token: string, id: string) =>
      apiRequest<{ coverLetter: string; resume: string }>(`/applications/${id}/files`, {
        token,
      }),
  },
};
