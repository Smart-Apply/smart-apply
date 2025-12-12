import { useAuthStore } from '@/stores/auth-store';
import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { toastSuccess, toastError } from '@/lib/toast';
import type { Application, ResumeData, PaginatedResponse } from '@/types';

/**
 * Hook to fetch all applications
 */
export function useApplications(options?: {
  refetchInterval?: UseQueryOptions<Application[]>['refetchInterval'];
  includeJobPosting?: boolean;
}) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return useQuery<Application[]>({
    queryKey: ['applications', { includeJobPosting: options?.includeJobPosting }],
    queryFn: async () => {
      const response = await api.applications.list({ includeJobPosting: options?.includeJobPosting });
      // Extract items from paginated response
      return response.items;
    },
    enabled: isAuthenticated,
    refetchInterval: options?.refetchInterval,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep unused data in cache for 10 minutes
    refetchOnWindowFocus: false, // DISABLED: Prevents rate limiting from tab switching
  });
}

/**
 * Hook to fetch single application
 */
export function useApplication(id: string) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return useQuery<Application>({
    queryKey: ['applications', id],
    queryFn: () => api.applications.getById(id),
    enabled: isAuthenticated && !!id,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep unused data in cache for 10 minutes
    refetchOnWindowFocus: false, // DISABLED: Prevents rate limiting from tab switching
  });
}

/**
 * Hook to create new application
 */
export function useCreateApplication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { jobPostingId: string }) =>
      api.applications.create(data),
    
    // Optimistic update: Add application to list immediately
    onMutate: async (newApplication) => {
      // Cancel outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ['applications'] });
      
      // Snapshot previous value for rollback
      const previousApplications = queryClient.getQueryData(['applications']);
      
      // Optimistically update cache with temporary application
      queryClient.setQueryData(['applications'], (old: Application[] | undefined) => {
        const tempApp: Application = {
          id: 'temp-' + Date.now(),
          userId: '', // Will be set by backend
          jobPostingId: newApplication.jobPostingId,
          status: 'PENDING' as const,
          applicationStatus: 'CREATED' as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        return [tempApp, ...(old || [])];
      });
      
      // Return context with snapshot for rollback
      return { previousApplications };
    },
    
    // Rollback on error
    onError: (error: unknown, _variables, context) => {
      if (context?.previousApplications) {
        queryClient.setQueryData(['applications'], context.previousApplications);
      }
      toastError(error, 'Fehler beim Erstellen der Bewerbung');
    },
    
    // Replace temp ID with real data on success
    onSuccess: (newApplication) => {
      queryClient.setQueryData(['applications'], (old: Application[] | undefined) => {
        if (!old) return [newApplication];
        return old.map(app => 
          app.id.startsWith('temp-') ? newApplication : app
        );
      });
      toastSuccess('Bewerbung wird erstellt...');
    },
    
    // Always refetch after mutation for data consistency
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
    },
  });
}

/**
 * Hook to create application with immediate LLM generation
 */
export function useCreateApplicationWithGeneration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { 
      jobPostingId: string; 
      coverLetterTemplateId?: string; 
      resumeTemplateId?: string; 
      generateCoverLetter?: boolean;
    }) =>
      api.applications.createWithGeneration(data),
    onSuccess: (application) => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      queryClient.setQueryData(['applications', application.id], application);
    },
    onError: (error: unknown) => {
      toastError(error, 'Fehler beim Generieren der Bewerbung');
    },
  });
}

/**
 * Hook to fetch application files (PDF URLs)
 */
export function useApplicationFiles(id: string) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return useQuery({
    queryKey: ['applications', id, 'files'],
    queryFn: () => api.applications.getFiles(id),
    enabled: isAuthenticated && !!id,
  });
}

/**
 * Hook to delete an application
 */
export function useDeleteApplication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      api.applications.delete(id),
    
    // Optimistic update: Remove application from list immediately
    onMutate: async (deletedId) => {
      // Cancel outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ['applications'] });
      await queryClient.cancelQueries({ queryKey: ['applications', deletedId] });
      
      // Snapshot previous values for rollback
      const previousApplications = queryClient.getQueryData(['applications']);
      const previousApplication = queryClient.getQueryData(['applications', deletedId]);
      
      // Optimistically remove from list
      queryClient.setQueryData(['applications'], (old: Application[] | undefined) => {
        if (!old) return [];
        return old.filter(app => app.id !== deletedId);
      });
      
      // Remove from detail cache
      queryClient.removeQueries({ queryKey: ['applications', deletedId] });
      
      // Return context with snapshots for rollback
      return { previousApplications, previousApplication, deletedId };
    },
    
    // Rollback on error
    onError: (error: unknown, _variables, context) => {
      if (context?.previousApplications) {
        queryClient.setQueryData(['applications'], context.previousApplications);
      }
      if (context?.previousApplication && context?.deletedId) {
        queryClient.setQueryData(['applications', context.deletedId], context.previousApplication);
      }
      toastError(error, 'Fehler beim Löschen der Bewerbung');
    },
    
    // Show success message
    onSuccess: () => {
      toastSuccess('Bewerbung wurde gelöscht');
    },
    
    // Always refetch after mutation for data consistency
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      queryClient.invalidateQueries({ queryKey: ['applications', variables] });
    },
  });
}

export function useUpdateApplicationResume(applicationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (resume: ResumeData) => api.applications.updateResume(applicationId, { resume }),
    onSuccess: (updatedApplication) => {
      // Optimistic update: Update cache directly without refetching
      queryClient.setQueryData(['applications', applicationId], updatedApplication);
      // Also invalidate keywords query (secondary data)
      queryClient.invalidateQueries({ queryKey: ['applications', applicationId, 'keywords'] });
      toastSuccess('Lebenslauf gespeichert');
    },
    onError: (error: unknown) => {
      toastError(error, 'Lebenslauf konnte nicht gespeichert werden');
    },
  });
}

export function useUpsertCoverLetter(applicationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { instructions?: string; content?: string; regenerate?: boolean }) =>
      api.applications.upsertCoverLetter(applicationId, data),
    onSuccess: (updatedApplication) => {
      // Optimistic update: Update cache directly without refetching
      queryClient.setQueryData(['applications', applicationId], updatedApplication);
      toastSuccess('Anschreiben aktualisiert');
    },
    onError: (error: unknown) => {
      toastError(error, 'Anschreiben konnte nicht aktualisiert werden');
    },
  });
}

export function useExportApplication(applicationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (language?: 'de' | 'en' | 'fr' | 'es' | 'it') => api.applications.export(applicationId, language),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications', applicationId] });
      toastSuccess('PDF-Export gestartet');
    },
    onError: (error: unknown) => {
      toastError(error, 'Export konnte nicht gestartet werden');
    },
  });
}

/**
 * Hook to analyze ATS keywords from job posting
 */
export function useAnalyzeKeywords(applicationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.applications.analyzeKeywords(applicationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications', applicationId] });
      queryClient.invalidateQueries({ queryKey: ['applications', applicationId, 'keywords'] });
      toastSuccess('Keywords wurden analysiert');
    },
    onError: (error: unknown) => {
      toastError(error, 'Keywords konnten nicht analysiert werden');
    },
  });
}

/**
 * Hook to fetch keyword analysis
 */
export function useKeywordsAnalysis(applicationId: string) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return useQuery({
    queryKey: ['applications', applicationId, 'keywords'],
    queryFn: () => api.applications.getKeywordsAnalysis(applicationId),
    enabled: isAuthenticated && !!applicationId,
    staleTime: 30 * 1000, // 30 seconds - allow fresh refetch after resume changes
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to retry failed application generation
 */
export function useRetryApplication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.applications.regenerate(id),
    onSuccess: (updatedApplication) => {
      // Update cache with new status (should be GENERATING)
      queryClient.setQueryData(['applications', updatedApplication.id], updatedApplication);
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      toastSuccess('Generierung wurde erneut gestartet');
    },
    onError: (error: unknown) => {
      toastError(error, 'Fehler beim erneuten Generieren');
    },
  });
}
