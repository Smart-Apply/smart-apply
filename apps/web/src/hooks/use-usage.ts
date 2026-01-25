'use client';

import { useMemo } from 'react';
import { useSubscription } from './use-subscription';

interface UsageResult {
  /** Number of items used in current period */
  used: number;
  /** Maximum limit (-1 for unlimited) */
  limit: number;
  /** Number of items remaining (-1 for unlimited) */
  remaining: number;
  /** Usage percentage (0-100, 0 for unlimited) */
  percentage: number;
  /** Whether the limit is unlimited */
  isUnlimited: boolean;
  /** Whether the user has exhausted their quota */
  isExhausted: boolean;
  /** Whether the user is running low (≤2 remaining) */
  isLow: boolean;
  /** Whether the subscription data is still loading */
  isLoading: boolean;
}

/**
 * Hook to get usage statistics for a specific action type
 * 
 * @example
 * ```tsx
 * const { used, limit, remaining, isExhausted, isLow } = useUsage('application');
 * 
 * if (isExhausted) {
 *   return <LimitReachedWarning />;
 * }
 * 
 * if (isLow) {
 *   return <LowQuotaWarning remaining={remaining} />;
 * }
 * ```
 */
export function useUsage(action: 'application' | 'interview'): UsageResult {
  const { usage, isLoading } = useSubscription();

  const result = useMemo(() => {
    // Default values when loading or no data
    if (!usage) {
      return {
        used: 0,
        limit: 5, // Default to FREE tier limit
        remaining: 5,
        percentage: 0,
        isUnlimited: false,
        isExhausted: false,
        isLow: false,
        isLoading,
      };
    }

    const stats = action === 'application' ? usage.applications : usage.interviewSessions;
    const { used, limit, remaining } = stats;

    // -1 means unlimited
    const isUnlimited = limit === -1;
    const percentage = isUnlimited ? 0 : Math.min(100, (used / limit) * 100);
    const isExhausted = !isUnlimited && remaining <= 0;
    const isLow = !isUnlimited && remaining > 0 && remaining <= 2;

    return {
      used,
      limit,
      remaining,
      percentage,
      isUnlimited,
      isExhausted,
      isLow,
      isLoading,
    };
  }, [usage, action, isLoading]);

  return result;
}

/**
 * Hook to get formatted period information
 * 
 * @example
 * ```tsx
 * const { periodStart, periodEnd, daysRemaining, periodLabel } = useUsagePeriod();
 * ```
 */
export function useUsagePeriod() {
  const { usage, isLoading } = useSubscription();

  return useMemo(() => {
    if (!usage) {
      return {
        periodStart: null,
        periodEnd: null,
        daysRemaining: 0,
        periodLabel: '',
        isLoading,
      };
    }

    const periodStart = new Date(usage.periodStart);
    const periodEnd = new Date(usage.periodEnd);
    const now = new Date();
    const daysRemaining = Math.max(
      0,
      Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    );

    const formatDate = (date: Date) =>
      date.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });

    const periodLabel = `${formatDate(periodStart)} - ${formatDate(periodEnd)}`;

    return {
      periodStart,
      periodEnd,
      daysRemaining,
      periodLabel,
      isLoading,
    };
  }, [usage, isLoading]);
}
