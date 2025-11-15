import { useAuthStore } from '@/stores/auth-store';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { toastSuccess, toastError } from '@/lib/toast';
import type { Application } from '@/types';

/**
 * Hook to fetch all applications
 */
export function useApplications() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return useQuery<Application[]>({
    queryKey: ['applications'],
    queryFn: () => api.applications.list(),
    enabled: isAuthenticated,
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
