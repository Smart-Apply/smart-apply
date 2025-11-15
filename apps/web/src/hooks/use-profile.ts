import { useAuthStore } from '@/stores/auth-store';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { toastSuccess, toastError } from '@/lib/toast';
import type { Profile, UpdateProfileDto } from '@/types';

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
  const updateUser = useAuthStore((state) => state.updateUser);

  return useMutation({
    mutationFn: (data: UpdateProfileDto) => api.profile.update(token!, data),
    onSuccess: (updatedProfile, variables) => {
      // Invalidate profile query to refetch
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      
      // Update user in auth store if fullName was changed
      if (variables.fullName) {
        updateUser({ name: variables.fullName });
      }
      
      toastSuccess('Profil erfolgreich aktualisiert');
    },
    onError: (error: unknown) => {
      toastError(error, 'Fehler beim Aktualisieren des Profils');
    },
  });
}
