import { useAuthStore } from '@/stores/auth-store';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { toastSuccess, toastError } from '@/lib/toast';
import type { JobPosting, PaginatedResponse } from '@/types';

/**
 * Hook to fetch all job postings
 */
export function useJobPostings() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return useQuery<JobPosting[]>({
    queryKey: ['job-postings'],
    queryFn: async () => {
      const response = await api.jobPostings.list();
      // Extract items from paginated response
      return response.items;
    },
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
 * Hook to create job posting manually
 */
export function useCreateJobPosting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
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
    }) => api.jobPostings.create(data),
    
    // Optimistic update: Add job posting to list immediately
    onMutate: async (newJobPosting) => {
      // Cancel outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ['job-postings'] });
      
      // Snapshot previous value for rollback
      const previousJobPostings = queryClient.getQueryData(['job-postings']);
      
      // Optimistically update cache with temporary job posting
      queryClient.setQueryData(['job-postings'], (old: JobPosting[] | undefined) => {
        const tempJobPosting: JobPosting = {
          id: 'temp-' + Date.now(),
          ...newJobPosting,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        return [tempJobPosting, ...(old || [])];
      });
      
      // Return context with snapshot for rollback
      return { previousJobPostings };
    },
    
    // Rollback on error
    onError: (error: unknown, _variables, context) => {
      if (context?.previousJobPostings) {
        queryClient.setQueryData(['job-postings'], context.previousJobPostings);
      }
      toastError(error, 'Fehler beim Erstellen der Stellenanzeige');
    },
    
    // Replace temp ID with real data on success
    onSuccess: (newJobPosting) => {
      queryClient.setQueryData(['job-postings'], (old: JobPosting[] | undefined) => {
        if (!old) return [newJobPosting];
        return old.map(jp => 
          jp.id.startsWith('temp-') ? newJobPosting : jp
        );
      });
      toastSuccess('Stellenanzeige erfolgreich erstellt');
    },
    
    // Always refetch after mutation for data consistency
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['job-postings'] });
    },
  });
}

/**
 * Hook to parse job posting from URL or text
 */
export function useParseJobPosting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { text?: string; url?: string; fileId?: string }) =>
      api.jobPostings.parse(data),
    
    // Optimistic update: Add placeholder job posting while parsing
    onMutate: async (parseData) => {
      // Cancel outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ['job-postings'] });
      
      // Snapshot previous value for rollback
      const previousJobPostings = queryClient.getQueryData(['job-postings']);
      
      // Optimistically add placeholder (parsing indicator)
      queryClient.setQueryData(['job-postings'], (old: JobPosting[] | undefined) => {
        const tempJobPosting: JobPosting = {
          id: 'temp-' + Date.now(),
          title: parseData.url ? 'Lädt...' : 'Wird analysiert...',
          company: parseData.url || 'Unbekannt',
          description: parseData.text || '',
          sourceUrl: parseData.url,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        return [tempJobPosting, ...(old || [])];
      });
      
      // Return context with snapshot for rollback
      return { previousJobPostings };
    },
    
    // Rollback on error
    onError: (error: unknown, _variables, context) => {
      if (context?.previousJobPostings) {
        queryClient.setQueryData(['job-postings'], context.previousJobPostings);
      }
      toastError(error, 'Fehler beim Analysieren der Stellenanzeige');
    },
    
    // Replace temp ID with real data on success
    onSuccess: (parsedJobPosting) => {
      queryClient.setQueryData(['job-postings'], (old: JobPosting[] | undefined) => {
        if (!old) return [parsedJobPosting];
        return old.map(jp => 
          jp.id.startsWith('temp-') ? parsedJobPosting : jp
        );
      });
      toastSuccess('Stellenanzeige erfolgreich analysiert');
    },
    
    // Always refetch after mutation for data consistency
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['job-postings'] });
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
    
    // Optimistic update: Remove job posting from list immediately
    onMutate: async (deletedId) => {
      // Cancel outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ['job-postings'] });
      await queryClient.cancelQueries({ queryKey: ['job-postings', deletedId] });
      
      // Snapshot previous values for rollback
      const previousJobPostings = queryClient.getQueryData(['job-postings']);
      const previousJobPosting = queryClient.getQueryData(['job-postings', deletedId]);
      
      // Optimistically remove from list
      queryClient.setQueryData(['job-postings'], (old: JobPosting[] | undefined) => {
        if (!old) return [];
        return old.filter(jp => jp.id !== deletedId);
      });
      
      // Remove from detail cache
      queryClient.removeQueries({ queryKey: ['job-postings', deletedId] });
      
      // Return context with snapshots for rollback
      return { previousJobPostings, previousJobPosting, deletedId };
    },
    
    // Rollback on error
    onError: (error: unknown, _variables, context) => {
      if (context?.previousJobPostings) {
        queryClient.setQueryData(['job-postings'], context.previousJobPostings);
      }
      if (context?.previousJobPosting && context?.deletedId) {
        queryClient.setQueryData(['job-postings', context.deletedId], context.previousJobPosting);
      }
      toastError(error, 'Fehler beim Löschen der Stellenanzeige');
    },
    
    // Show success message
    onSuccess: () => {
      toastSuccess('Stellenanzeige erfolgreich gelöscht');
    },
    
    // Always refetch after mutation for data consistency
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['job-postings'] });
    },
  });
}
