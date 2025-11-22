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
}) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return useQuery<Application[]>({
    queryKey: ['applications'],
    queryFn: () => api.applications.list(),
    enabled: isAuthenticated,
    refetchInterval: options?.refetchInterval,
    staleTime: 30000, // Consider data fresh for 30 seconds
    gcTime: 5 * 60 * 1000, // Keep unused data in cache for 5 minutes
    refetchOnWindowFocus: true, // Refetch when user returns to tab
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
    staleTime: 30000, // Consider data fresh for 30 seconds
    gcTime: 5 * 60 * 1000, // Keep unused data in cache for 5 minutes
    refetchOnWindowFocus: true, // Refetch when user returns to tab
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
    mutationFn: (data: { jobPostingId: string }) =>
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
 * Note: Does NOT automatically invalidate queries to allow batch operations.
 * Call queryClient.invalidateQueries manually after batch deletions.
 */
export function useDeleteApplication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      api.applications.delete(id),
    onSuccess: (_data, variables) => {
      // Optimistically remove from cache without refetching
      queryClient.setQueryData<Application[]>(['applications'], (old) => 
        old ? old.filter(app => app.id !== variables) : []
      );
      toastSuccess('Bewerbung wurde gelöscht');
    },
    onError: (error: unknown) => {
      // On error, refetch to restore correct state
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      toastError(error, 'Fehler beim Löschen der Bewerbung');
    },
  });
}

export function useUpdateApplicationResume(applicationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (resume: ResumeData) => api.applications.updateResume(applicationId, { resume }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications', applicationId] });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications', applicationId] });
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
    mutationFn: () => api.applications.export(applicationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications', applicationId] });
      toastSuccess('PDF-Export gestartet');
    },
    onError: (error: unknown) => {
      toastError(error, 'Export konnte nicht gestartet werden');
    },
  });
}
