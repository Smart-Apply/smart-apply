import { useAuthStore } from '@/stores/auth-store';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { toast } from 'sonner';
import type { JobPosting } from '@/types';

/**
 * Hook to fetch all job postings
 */
export function useJobPostings() {
  const token = useAuthStore((state) => state.token);

  return useQuery<JobPosting[]>({
    queryKey: ['job-postings'],
    queryFn: () => api.jobPostings.list(token!),
    enabled: !!token,
  });
}

/**
 * Hook to fetch single job posting
 */
export function useJobPosting(id: number) {
  const token = useAuthStore((state) => state.token);

  return useQuery<JobPosting>({
    queryKey: ['job-postings', id],
    queryFn: () => api.jobPostings.getById(token!, id),
    enabled: !!token && !!id,
  });
}

/**
 * Hook to parse job posting from URL or text
 */
export function useParseJobPosting() {
  const token = useAuthStore((state) => state.token);

  return useMutation({
    mutationFn: (data: { text?: string; url?: string; fileId?: string }) =>
      api.jobPostings.parse(token!, data),
    onSuccess: () => {
      toast.success('Stellenanzeige erfolgreich geparst');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Fehler beim Parsen der Stellenanzeige');
    },
  });
}

/**
 * Hook to delete job posting
 */
export function useDeleteJobPosting() {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => api.jobPostings.delete(token!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-postings'] });
      toast.success('Stellenanzeige erfolgreich gelöscht');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Fehler beim Löschen der Stellenanzeige');
    },
  });
}
