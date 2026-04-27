import { useAuthStore } from '@/stores/auth-store';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { toastSuccess, toastError } from '@/lib/toast';
import type {
  InterviewSessionDetail,
  StartInterviewDto,
  SubmitAnswerDto,
  InterviewSessionStatus,
} from '@/types';

/**
 * Hook to fetch all interview sessions
 */
export function useInterviewSessions(options?: {
  status?: InterviewSessionStatus;
  limit?: number;
  offset?: number;
  /**
   * Optional gate. Set to false (e.g. for FREE-tier users without the
   * interviewCoach feature) to suppress the request entirely so the
   * backend's 403s never reach the console.
   */
  enabled?: boolean;
}) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const { enabled: gated = true, ...listOptions } = options ?? {};

  return useQuery({
    queryKey: ['interviews', 'list', listOptions],
    queryFn: () => api.interviews.list(listOptions),
    enabled: isAuthenticated && gated,
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Hook to fetch a single interview session with details
 */
export function useInterviewSession(sessionId: string | undefined) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return useQuery({
    queryKey: ['interviews', 'detail', sessionId],
    queryFn: () => api.interviews.get(sessionId!),
    enabled: isAuthenticated && !!sessionId,
    staleTime: 10000, // 10 seconds - refresh more often during active sessions
  });
}

/**
 * Hook to fetch interview statistics
 */
export function useInterviewStats(options?: {
  /**
   * Optional gate. Set to false for FREE-tier users without the
   * interviewCoach feature to suppress the 403 request entirely.
   */
  enabled?: boolean;
}) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const gated = options?.enabled ?? true;

  return useQuery({
    queryKey: ['interviews', 'stats'],
    queryFn: () => api.interviews.getStats(),
    enabled: isAuthenticated && gated,
    staleTime: 60000, // 1 minute
  });
}

/**
 * Hook to start a new interview session
 */
export function useStartInterview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: StartInterviewDto) => api.interviews.start(data),
    onSuccess: (session) => {
      queryClient.invalidateQueries({ queryKey: ['interviews', 'list'] });
      queryClient.setQueryData(['interviews', 'detail', session.id], session);
      toastSuccess('Interview-Session gestartet');
    },
    onError: (error: unknown) => {
      toastError(error, 'Fehler beim Starten der Interview-Session');
    },
  });
}

/**
 * Hook to submit an answer to a question
 */
export function useSubmitAnswer(sessionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      questionId,
      data,
    }: {
      questionId: string;
      data: SubmitAnswerDto;
    }) => api.interviews.submitAnswer(sessionId, questionId, data),
    onSuccess: (response) => {
      // Update the session in cache with the updated question
      queryClient.setQueryData<InterviewSessionDetail>(
        ['interviews', 'detail', sessionId],
        (old) => {
          if (!old) return old;
          return {
            ...old,
            questions: old.questions.map((q) =>
              q.id === response.question.id ? response.question : q
            ),
            answeredCount: old.answeredCount + 1,
          };
        }
      );
    },
    onError: (error: unknown) => {
      toastError(error, 'Fehler beim Absenden der Antwort');
    },
  });
}

/**
 * Hook to get the next question in a session
 */
export function useGetNextQuestion(sessionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.interviews.getNextQuestion(sessionId),
    onSuccess: (response) => {
      // Add the new question to the session in cache
      queryClient.setQueryData<InterviewSessionDetail>(
        ['interviews', 'detail', sessionId],
        (old) => {
          if (!old) return old;
          // Only add if not already present
          const exists = old.questions.some((q) => q.id === response.question.id);
          if (exists) return old;
          return {
            ...old,
            questions: [...old.questions, response.question],
            questionsCount: response.totalQuestions,
          };
        }
      );
    },
    onError: (error: unknown) => {
      toastError(error, 'Fehler beim Laden der nächsten Frage');
    },
  });
}

/**
 * Hook to complete an interview session
 */
export function useCompleteInterview(sessionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.interviews.complete(sessionId),
    onSuccess: (session) => {
      queryClient.setQueryData(['interviews', 'detail', sessionId], session);
      queryClient.invalidateQueries({ queryKey: ['interviews', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['interviews', 'stats'] });
      toastSuccess('Interview abgeschlossen! Feedback wird generiert...');
    },
    onError: (error: unknown) => {
      toastError(error, 'Fehler beim Abschließen des Interviews');
    },
  });
}

/**
 * Hook to abandon an interview session
 */
export function useAbandonInterview(sessionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.interviews.abandon(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interviews', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['interviews', 'detail', sessionId] });
      toastSuccess('Interview-Session abgebrochen');
    },
    onError: (error: unknown) => {
      toastError(error, 'Fehler beim Abbrechen der Session');
    },
  });
}
