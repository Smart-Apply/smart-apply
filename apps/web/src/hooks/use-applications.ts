import { useAuthStore } from '@/stores/auth-store';
import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { toastSuccess, toastError } from '@/lib/toast';
import type { Application, ResumeData } from '@/types';

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
    queryFn: () => api.applications.list({ includeJobPosting: options?.includeJobPosting }),
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      toastSuccess('Bewerbung wird erstellt...');
    },
    onError: (error: unknown) => {
      toastError(error, 'Fehler beim Erstellen der Bewerbung');
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
    onSuccess: (_data, variables) => {
      // Invalidate queries to trigger refetch from server
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      queryClient.invalidateQueries({ queryKey: ['applications', variables] });
      toastSuccess('Bewerbung wurde gelöscht');
    },
    onError: (error: unknown) => {
      toastError(error, 'Fehler beim Löschen der Bewerbung');
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
