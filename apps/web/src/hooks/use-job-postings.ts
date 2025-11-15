import { useAuthStore } from '@/stores/auth-store';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { toastSuccess, toastError } from '@/lib/toast';
import type { JobPosting } from '@/types';

/**
 * Hook to fetch all job postings
 */
export function useJobPostings() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return useQuery<JobPosting[]>({
    queryKey: ['job-postings'],
    queryFn: () => api.jobPostings.list(),
    enabled: isAuthenticated,
  });
}

/**
 * Hook to fetch single job posting
 */
export function useJobPosting(id: string) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return useQuery<JobPosting>({
    queryKey: ['job-postings', id],
    queryFn: () => api.jobPostings.getById(id),
    enabled: isAuthenticated && !!id,
  });
}

/**
 * Hook to parse job posting from URL or text
 */
export function useParseJobPosting() {
  return useMutation({
    mutationFn: (data: { text?: string; url?: string; fileId?: string }) =>
      api.jobPostings.parse(data),
    onSuccess: () => {
      toastSuccess('Stellenanzeige erfolgreich geparst');
    },
    onError: (error: unknown) => {
      toastError(error, 'Fehler beim Parsen der Stellenanzeige');
    },
  });
}

/**
 * Hook to delete job posting
 */
export function useDeleteJobPosting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.jobPostings.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-postings'] });
      toastSuccess('Stellenanzeige erfolgreich gelöscht');
    },
    onError: (error: unknown) => {
      toastError(error, 'Fehler beim Löschen der Stellenanzeige');
    },
  });
}
