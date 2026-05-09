import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { toastError, toastSuccess } from '@/lib/toast';
import type {
  JobPosting,
  JobSearchSourcesResponse,
  UnifiedJob,
  UnifiedJobSearchRequest,
  UnifiedJobSearchResponse,
} from '@/types';

/**
 * Discover the configured job-search sources and their availability for
 * the current user. Drives the "Search in:" picker so we don't show
 * (or worse, fail) sources the user can't actually use.
 *
 * Cheap to fetch (just reads the in-memory provider registry), so we
 * keep it fresh on window focus rather than caching aggressively.
 */
export function useJobSearchSources() {
  return useQuery<JobSearchSourcesResponse, Error>({
    queryKey: ['job-search', 'sources'],
    queryFn: () => api.jobSearch.sources(),
    staleTime: 60_000,
  });
}

/**
 * Fan-out job search across all configured providers (LinkedIn via
 * Apify, Arbeitnow public API, …). One failing provider doesn't take
 * down the whole response — inspect `data.sources[]` to surface
 * partial failures to the user.
 *
 * Throttled server-side to 30 searches/hour per user.
 */
export function useJobSearch() {
  return useMutation<UnifiedJobSearchResponse, Error, UnifiedJobSearchRequest>({
    mutationFn: (request) => api.jobSearch.search(request),
    onError: (error) => {
      toastError(error.message || 'Job-Suche fehlgeschlagen');
    },
  });
}

/**
 * Import a single unified search result as a `JobPosting`. The backend
 * dispatches to the originating provider based on `job.source`, so this
 * one hook handles imports from every source.
 *
 * Throttled server-side to 60 imports/hour per user. Caller is
 * responsible for navigating into the application wizard with the
 * returned id.
 */
export function useImportUnifiedJob() {
  const queryClient = useQueryClient();

  return useMutation<JobPosting, Error, UnifiedJob>({
    mutationFn: (job) => api.jobSearch.import(job),
    onSuccess: (jobPosting) => {
      queryClient.invalidateQueries({ queryKey: ['job-postings'] });
      toastSuccess(`„${jobPosting.title}" wurde importiert.`);
    },
    onError: (error) => {
      toastError(error.message || 'Import fehlgeschlagen');
    },
  });
}
