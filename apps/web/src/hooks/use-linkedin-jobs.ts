import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { toastError, toastSuccess } from '@/lib/toast';
import type {
  JobPosting,
  LinkedInJob,
  LinkedInJobSearchFilters,
  LinkedInJobSearchResponse,
} from '@/types';

/**
 * Run a LinkedIn job search via the backend Apify proxy.
 *
 * Counts against the user's `jobParsing` quota and is throttled to
 * 10 searches/hour server-side.
 */
export function useLinkedInJobSearch() {
  return useMutation<LinkedInJobSearchResponse, Error, LinkedInJobSearchFilters>({
    mutationFn: (filters) => api.linkedinJobs.search(filters),
    onError: (error) => {
      toastError(error.message || 'LinkedIn-Suche fehlgeschlagen');
    },
  });
}

/**
 * Import a single LinkedIn search result as a JobPosting.
 *
 * On success, invalidates the `job-postings` cache so the new entry shows
 * up everywhere it's listed. The caller is responsible for navigating
 * the user into the application wizard (e.g. with the returned id).
 */
export function useImportLinkedInJob() {
  const queryClient = useQueryClient();

  return useMutation<JobPosting, Error, LinkedInJob>({
    mutationFn: (job) => api.linkedinJobs.import(job),
    onSuccess: (jobPosting) => {
      queryClient.invalidateQueries({ queryKey: ['job-postings'] });
      toastSuccess(`„${jobPosting.title}" wurde importiert.`);
    },
    onError: (error) => {
      toastError(error.message || 'Import fehlgeschlagen');
    },
  });
}
