import { useAuthStore } from '@/stores/auth-store';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { toast } from 'sonner';
import type { Application } from '@/types';

/**
 * Hook to fetch all applications
 */
export function useApplications() {
  const token = useAuthStore((state) => state.token);

  return useQuery<Application[]>({
    queryKey: ['applications'],
    queryFn: () => api.applications.list(token!),
    enabled: !!token,
  });
}

/**
 * Hook to fetch single application
 */
export function useApplication(id: string) {
  const token = useAuthStore((state) => state.token);

  return useQuery<Application>({
    queryKey: ['applications', id],
    queryFn: () => api.applications.getById(token!, id),
    enabled: !!token && !!id,
  });
}

/**
 * Hook to create new application
 */
export function useCreateApplication() {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { jobPostingId: string }) =>
      api.applications.create(token!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      toast.success('Bewerbung wird erstellt...');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Fehler beim Erstellen der Bewerbung');
    },
  });
}

/**
 * Hook to fetch application files (PDF URLs)
 */
export function useApplicationFiles(id: string) {
  const token = useAuthStore((state) => state.token);

  return useQuery({
    queryKey: ['applications', id, 'files'],
    queryFn: () => api.applications.getFiles(token!, id),
    enabled: !!token && !!id,
  });
}
