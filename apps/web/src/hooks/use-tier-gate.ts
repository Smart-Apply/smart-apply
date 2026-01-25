'use client';

import { useMemo } from 'react';
import { useSubscription } from './use-subscription';
import type { SubscriptionTier, TierFeatures } from '@/types';

/**
 * Tier hierarchy for comparison
 * Higher number = higher tier
 */
const TIER_ORDER: Record<SubscriptionTier, number> = {
  FREE: 0,
  PREMIUM: 1,
  PREMIUM_PLUS: 2,
};

interface TierGateResult {
  /** Whether the user has access to the required tier */
  hasAccess: boolean;
  /** User's current tier */
  currentTier: SubscriptionTier;
  /** The tier required for access */
  requiredTier: SubscriptionTier;
  /** Whether to show an upgrade prompt */
  showUpgrade: boolean;
  /** Whether the subscription data is still loading */
  isLoading: boolean;
}

/**
 * Hook to check if user has access to a specific tier level
 * 
 * @example
 * ```tsx
 * const { hasAccess, showUpgrade } = useTierGate('PREMIUM');
 * if (!hasAccess) return <UpgradePrompt />;
 * ```
 */
export function useTierGate(requiredTier: SubscriptionTier): TierGateResult {
  const { tier, isLoading } = useSubscription();

  const result = useMemo(() => {
    const hasAccess = TIER_ORDER[tier] >= TIER_ORDER[requiredTier];

    return {
      hasAccess,
      currentTier: tier,
      requiredTier,
      showUpgrade: !hasAccess,
      isLoading,
    };
  }, [tier, requiredTier, isLoading]);

  return result;
}

interface FeatureGateResult {
  /** Whether the user has access to this feature */
  hasAccess: boolean;
  /** User's current tier */
  currentTier: SubscriptionTier;
  /** Whether to show an upgrade prompt */
  showUpgrade: boolean;
  /** Whether the subscription data is still loading */
  isLoading: boolean;
}

/**
 * Hook to check if user has access to a specific feature
 * 
 * @example
 * ```tsx
 * const { hasAccess } = useFeatureGate('interviewCoach');
 * if (!hasAccess) return <UpgradePrompt feature="Interview Coach" />;
 * ```
 */
export function useFeatureGate(feature: keyof TierFeatures): FeatureGateResult {
  const { tier, features, isLoading } = useSubscription();

  const result = useMemo(() => {
    const hasAccess = features?.[feature] ?? false;

    return {
      hasAccess,
      currentTier: tier,
      showUpgrade: !hasAccess,
      isLoading,
    };
  }, [tier, features, feature, isLoading]);

  return result;
}
