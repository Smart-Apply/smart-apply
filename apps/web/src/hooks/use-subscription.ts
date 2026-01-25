'use client';

import { useEffect, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import {
  useSubscriptionStore,
  useTier,
  useIsPremium,
  useIsPremiumPlus,
  useTierFeatures,
} from '@/stores/subscription-store';
import type { SubscriptionUsageStats, TierLimits } from '@/types';

/**
 * Main hook for subscription management
 * Fetches subscription data and provides access to tier, usage, and limits
 */
export function useSubscription() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const { subscription, isLoading: storeLoading, error: storeError, setSubscription, setLoading, setError } = useSubscriptionStore();
  
  // Computed values from store (primitives only to avoid re-render loops)
  const tier = useTier();
  const isPremium = useIsPremium();
  const isPremiumPlus = useIsPremiumPlus();
  const features = useTierFeatures();

  // React Query for data fetching with caching
  const {
    data,
    isLoading: queryLoading,
    error: queryError,
    refetch,
  } = useQuery<SubscriptionUsageStats>({
    queryKey: ['subscription'],
    queryFn: () => api.subscription.get(),
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000, // Consider fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchOnWindowFocus: false, // Don't refetch on focus to save API calls
  });

  // Sync query data to store
  useEffect(() => {
    if (data) {
      setSubscription(data);
    }
  }, [data, setSubscription]);

  // Sync loading state
  useEffect(() => {
    setLoading(queryLoading);
  }, [queryLoading, setLoading]);

  // Sync error state
  useEffect(() => {
    if (queryError) {
      setError(queryError instanceof Error ? queryError.message : 'Failed to load subscription');
    }
  }, [queryError, setError]);

  // Refresh function that can be called manually
  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  // Compute limits from subscription data (memoized to prevent re-renders)
  const limits = useMemo((): TierLimits => {
    if (!subscription) {
      return {
        applicationsPerMonth: 5,
        interviewSessionsPerMonth: 0,
        priority: 'low',
        features: {
          customTemplates: false,
          prioritySupport: false,
          advancedAnalytics: false,
          interviewCoach: false,
        },
      };
    }

    return {
      applicationsPerMonth: subscription.applications.limit,
      interviewSessionsPerMonth: subscription.interviewSessions.limit,
      priority: tier === 'PREMIUM_PLUS' ? 'high' : tier === 'PREMIUM' ? 'normal' : 'low',
      features: subscription.features,
    };
  }, [subscription, tier]);

  return {
    // Data
    subscription,
    usage: subscription
      ? {
          applications: subscription.applications,
          interviewSessions: subscription.interviewSessions,
          periodStart: subscription.periodStart,
          periodEnd: subscription.periodEnd,
        }
      : null,

    // Computed
    tier,
    isPremium,
    isPremiumPlus,
    limits,
    features,

    // Status
    isLoading: storeLoading || queryLoading,
    error: storeError,

    // Actions
    refresh,
  };
}

/**
 * Check if user can perform a specific action
 * Returns the result from the API including remaining quota
 */
export function useCanPerformAction(action: 'application' | 'interview') {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return useQuery({
    queryKey: ['subscription', 'can-perform', action],
    queryFn: () => api.subscription.canPerform(action),
    enabled: isAuthenticated,
    staleTime: 30 * 1000, // Fresh for 30 seconds
    gcTime: 60 * 1000, // Cache for 1 minute
  });
}
