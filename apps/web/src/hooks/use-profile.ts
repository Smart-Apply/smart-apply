import { useAuthStore } from '@/stores/auth-store';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { toastSuccess, toastError } from '@/lib/toast';
import type { Profile, UpdateProfileDto } from '@/types';

/**
 * Hook to fetch user profile
 */
export function useProfile() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return useQuery<Profile>({
    queryKey: ['profile'],
    queryFn: () => api.profile.get(),
    enabled: isAuthenticated,
    staleTime: Infinity, // Never refetch automatically, only on invalidation or manual refetch
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
    refetchOnMount: false, // Don't refetch on component mount if data exists
  });
}

/**
 * Hook to update user profile
 */
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const updateUser = useAuthStore((state) => state.updateUser);

  return useMutation({
    mutationFn: (data: UpdateProfileDto) => api.profile.update(data),
    onSuccess: (updatedProfile, variables) => {
      // Update cache directly with the server response (no refetch)
      queryClient.setQueryData(['profile'], updatedProfile);
      
      // Update user in auth store if firstName or lastName was changed
      if (variables.firstName || variables.lastName) {
        updateUser({ 
          firstName: variables.firstName, 
          lastName: variables.lastName 
        });
      }
      
      toastSuccess('Profil erfolgreich aktualisiert');
    },
    onError: (error: unknown) => {
      toastError(error, 'Fehler beim Aktualisieren des Profils');
    },
  });
}
