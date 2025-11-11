import { useAuthStore } from '@/stores/auth-store';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { toast } from 'sonner';
import type { Profile } from '@/types';

/**
 * Hook to fetch user profile
 */
export function useProfile() {
  const token = useAuthStore((state) => state.token);

  return useQuery<Profile>({
    queryKey: ['profile'],
    queryFn: () => api.profile.get(token!),
    enabled: !!token,
  });
}

/**
 * Hook to update user profile
 */
export function useUpdateProfile() {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<Profile>) => api.profile.update(token!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success('Profil erfolgreich aktualisiert');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Fehler beim Aktualisieren des Profils');
    },
  });
}
