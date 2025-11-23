import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { SessionsResponse } from '@/types';
import { useAuthStore } from '@/stores/auth-store';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

/**
 * Hook to fetch all active sessions
 */
export function useSessions() {
  return useQuery<SessionsResponse>({
    queryKey: ['sessions'],
    queryFn: () => api.sessions.list(),
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
  });
}

/**
 * Hook to revoke a specific session
 */
export function useRevokeSession() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const clearAuth = useAuthStore((state) => state.clearAuth);

  return useMutation({
    mutationFn: (sessionId: string) => api.sessions.revoke(sessionId),
    onSuccess: (data, sessionId) => {
      // Get current session data to check if we revoked our own session
      const sessionsData = queryClient.getQueryData<SessionsResponse>(['sessions']);
      const isCurrentSession = sessionsData?.currentSessionId === sessionId;

      if (isCurrentSession) {
        // User logged out from current session - redirect to login
        toast.success('Current session logged out');
        clearAuth();
        router.push('/login');
      } else {
        // Successfully revoked another session
        toast.success('Session revoked successfully');
        
        // Invalidate sessions query to refresh the list
        queryClient.invalidateQueries({ queryKey: ['sessions'] });
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to revoke session');
    },
  });
}

/**
 * Hook to revoke all sessions (logout from all devices)
 */
export function useRevokeAllSessions() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const clearAuth = useAuthStore((state) => state.clearAuth);

  return useMutation({
    mutationFn: () => api.sessions.revokeAll(),
    onSuccess: (data: { message: string; revokedCount: number }) => {
      toast.success(`Logged out from ${data.revokedCount} device${data.revokedCount !== 1 ? 's' : ''}`);
      
      // Clear all queries and logout
      queryClient.clear();
      clearAuth();
      router.push('/login');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to logout from all devices');
    },
  });
}
