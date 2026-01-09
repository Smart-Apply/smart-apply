/**
 * Translation Hook
 * Provides language translation functionality with retry logic and caching
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { toastError } from '@/lib/toast';
import { useAuthStore } from '@/stores/auth-store';
import type { TranslationResponse, TranslationCacheStatusResponse, ResumeData } from '@/types';
import { useState, useCallback } from 'react';

// Maximum retry attempts for translation
const MAX_RETRIES = 3;

// Delay between retries (exponential backoff)
const getRetryDelay = (attempt: number) => Math.min(1000 * Math.pow(2, attempt), 10000);

/**
 * Hook to get translation cache status for UI badges
 */
export function useTranslationCacheStatus(applicationId: string) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return useQuery<TranslationCacheStatusResponse>({
    queryKey: ['applications', applicationId, 'translation-cache-status'],
    queryFn: () => api.applications.getTranslationCacheStatus(applicationId),
    enabled: isAuthenticated && !!applicationId,
    staleTime: 60 * 1000, // Consider data fresh for 1 minute
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to translate application content
 * Returns mutation with retry logic and state tracking
 */
export function useTranslateApplication(applicationId: string) {
  const queryClient = useQueryClient();
  const [retryCount, setRetryCount] = useState(0);
  const [lastError, setLastError] = useState<Error | null>(null);

  const mutation = useMutation({
    mutationFn: async (data: { 
      targetLanguage: string; 
      force?: boolean; 
      sections?: string[];
    }) => {
      return api.applications.translate(applicationId, data);
    },
    onSuccess: () => {
      // Reset retry count on success
      setRetryCount(0);
      setLastError(null);

      // Invalidate cache status query to refresh badges
      queryClient.invalidateQueries({
        queryKey: ['applications', applicationId, 'translation-cache-status'],
      });
    },
    onError: (error: Error) => {
      setLastError(error);
      
      // Only show toast on final failure (after all retries)
      if (retryCount >= MAX_RETRIES - 1) {
        toastError(error, 'Übersetzung fehlgeschlagen');
      }
    },
  });

  /**
   * Translate with automatic retry logic
   */
  const translateWithRetry = useCallback(
    async (
      targetLanguage: string,
      options?: { force?: boolean; sections?: string[] }
    ): Promise<TranslationResponse | null> => {
      setRetryCount(0);
      setLastError(null);

      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          setRetryCount(attempt);
          const result = await mutation.mutateAsync({
            targetLanguage,
            force: options?.force,
            sections: options?.sections,
          });
          return result;
        } catch (error) {
          setLastError(error as Error);
          
          // Don't retry on certain errors
          if (error instanceof Error) {
            const message = error.message.toLowerCase();
            // Don't retry rate limit errors - let user know to wait
            if (message.includes('rate limit') || message.includes('429')) {
              toastError(error, 'Übersetzungslimit erreicht. Bitte warten Sie einige Minuten.');
              return null;
            }
            // Don't retry validation errors
            if (message.includes('400') || message.includes('validation')) {
              toastError(error, 'Ungültige Übersetzungsanfrage');
              return null;
            }
          }

          // Wait before retry (exponential backoff)
          if (attempt < MAX_RETRIES - 1) {
            await new Promise((resolve) => setTimeout(resolve, getRetryDelay(attempt)));
          }
        }
      }

      // All retries failed
      toastError(lastError, 'Übersetzung nach 3 Versuchen fehlgeschlagen');
      return null;
    },
    [mutation, lastError]
  );

  /**
   * Manual retry (user-triggered)
   */
  const retryManually = useCallback(
    (targetLanguage: string, options?: { force?: boolean }) => {
      return translateWithRetry(targetLanguage, { ...options, force: true });
    },
    [translateWithRetry]
  );

  return {
    translate: translateWithRetry,
    retryManually,
    isTranslating: mutation.isPending,
    retryCount,
    maxRetries: MAX_RETRIES,
    lastError,
    canRetry: retryCount < MAX_RETRIES && !mutation.isPending,
  };
}

/**
 * Combined hook for translation with cache status
 * Provides both translation functionality and cache badges
 */
export function useApplicationTranslation(applicationId: string) {
  const cacheStatus = useTranslationCacheStatus(applicationId);
  const translation = useTranslateApplication(applicationId);

  /**
   * Check if a language is cached (badge indicator)
   */
  const isLanguageCached = useCallback(
    (language: string): boolean => {
      if (!cacheStatus.data) return false;
      return cacheStatus.data.cachedLanguages.includes(language);
    },
    [cacheStatus.data]
  );

  /**
   * Check if a language is the source language (no translation needed)
   */
  const isSourceLanguage = useCallback(
    (language: string): boolean => {
      if (!cacheStatus.data) return false;
      return cacheStatus.data.sourceLanguage === language;
    },
    [cacheStatus.data]
  );

  /**
   * Smart translate - skips if source language or uses cache if available
   */
  const smartTranslate = useCallback(
    async (
      targetLanguage: string,
      currentContent: { resume: ResumeData; coverLetter: string }
    ): Promise<{ resume: ResumeData; coverLetter: string } | null> => {
      // If target is source language, return current content
      if (isSourceLanguage(targetLanguage)) {
        return currentContent;
      }

      const result = await translation.translate(targetLanguage);
      if (!result) return null;

      return {
        resume: result.resumeText,
        coverLetter: result.coverLetterText,
      };
    },
    [translation, isSourceLanguage]
  );

  return {
    // Cache status
    cachedLanguages: cacheStatus.data?.cachedLanguages ?? [],
    sourceLanguage: cacheStatus.data?.sourceLanguage ?? 'de',
    isLoadingCacheStatus: cacheStatus.isLoading,
    cacheStatusError: cacheStatus.error,
    refetchCacheStatus: cacheStatus.refetch,

    // Translation
    translate: translation.translate,
    smartTranslate,
    isTranslating: translation.isTranslating,
    retryCount: translation.retryCount,
    maxRetries: translation.maxRetries,
    lastError: translation.lastError,
    canRetry: translation.canRetry,
    retryManually: translation.retryManually,

    // Helpers
    isLanguageCached,
    isSourceLanguage,
  };
}
