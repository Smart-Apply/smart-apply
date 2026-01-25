'use client';

import type { ReactNode } from 'react';
import { useTierGate, useFeatureGate } from '@/hooks/use-tier-gate';
import { UpgradePrompt } from './upgrade-prompt';
import { Skeleton } from '@/components/ui/skeleton';
import type { SubscriptionTier, TierFeatures } from '@/types';

interface FeatureGateProps {
  /** Required tier to access this feature */
  requiredTier: SubscriptionTier;
  /** Display name of the feature (shown in upgrade prompt) */
  feature: string;
  /** Optional description for the upgrade prompt */
  description?: string;
  /** Content to show when user has access */
  children: ReactNode;
  /** Optional fallback when user doesn't have access (defaults to UpgradePrompt) */
  fallback?: ReactNode;
  /** Variant style for the fallback prompt */
  fallbackVariant?: 'default' | 'compact' | 'inline';
  /** Show loading skeleton while checking access */
  showLoadingSkeleton?: boolean;
}

/**
 * FeatureGate - Conditionally renders content based on subscription tier
 * 
 * @example
 * ```tsx
 * // Basic usage - shows UpgradePrompt for non-premium users
 * <FeatureGate requiredTier="PREMIUM" feature="Interview Coach">
 *   <InterviewCoachComponent />
 * </FeatureGate>
 * 
 * // With description
 * <FeatureGate 
 *   requiredTier="PREMIUM_PLUS" 
 *   feature="Unbegrenzte Bewerbungen"
 *   description="Erstelle so viele Bewerbungen wie du möchtest"
 * >
 *   <UnlimitedApplicationsFeature />
 * </FeatureGate>
 * 
 * // Custom fallback
 * <FeatureGate 
 *   requiredTier="PREMIUM" 
 *   feature="Analytics"
 *   fallback={<p>Premium required for analytics</p>}
 * >
 *   <AnalyticsDashboard />
 * </FeatureGate>
 * ```
 */
export function FeatureGate({
  requiredTier,
  feature,
  description,
  children,
  fallback,
  fallbackVariant = 'default',
  showLoadingSkeleton = true,
}: FeatureGateProps) {
  const { hasAccess, isLoading } = useTierGate(requiredTier);

  // Show loading state
  if (isLoading && showLoadingSkeleton) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  // User has access - render children
  if (hasAccess) {
    return <>{children}</>;
  }

  // User doesn't have access - render fallback or default UpgradePrompt
  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <UpgradePrompt
      feature={feature}
      requiredTier={requiredTier}
      description={description}
      variant={fallbackVariant}
    />
  );
}

interface FeatureFeatureGateProps {
  /** Required feature (from TierFeatures) */
  requiredFeature: keyof TierFeatures;
  /** Display name of the feature (shown in upgrade prompt) */
  feature: string;
  /** Tier needed to access this feature (for the upgrade prompt) */
  requiredTier?: SubscriptionTier;
  /** Optional description for the upgrade prompt */
  description?: string;
  /** Content to show when user has access */
  children: ReactNode;
  /** Optional fallback when user doesn't have access */
  fallback?: ReactNode;
  /** Variant style for the fallback prompt */
  fallbackVariant?: 'default' | 'compact' | 'inline';
}

/**
 * FeatureFeatureGate - Conditionally renders content based on specific feature access
 * 
 * @example
 * ```tsx
 * <FeatureFeatureGate 
 *   requiredFeature="interviewCoach" 
 *   feature="Interview Coach"
 *   requiredTier="PREMIUM"
 * >
 *   <InterviewCoachComponent />
 * </FeatureFeatureGate>
 * ```
 */
export function FeatureFeatureGate({
  requiredFeature,
  feature,
  requiredTier = 'PREMIUM',
  description,
  children,
  fallback,
  fallbackVariant = 'default',
}: FeatureFeatureGateProps) {
  const { hasAccess, isLoading } = useFeatureGate(requiredFeature);

  // Show loading state
  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  // User has access - render children
  if (hasAccess) {
    return <>{children}</>;
  }

  // User doesn't have access - render fallback or default UpgradePrompt
  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <UpgradePrompt
      feature={feature}
      requiredTier={requiredTier}
      description={description}
      variant={fallbackVariant}
    />
  );
}

/**
 * PremiumGate - Shorthand for FeatureGate with PREMIUM tier
 */
export function PremiumGate({
  feature,
  description,
  children,
  fallback,
  fallbackVariant,
}: Omit<FeatureGateProps, 'requiredTier'>) {
  return (
    <FeatureGate
      requiredTier="PREMIUM"
      feature={feature}
      description={description}
      fallback={fallback}
      fallbackVariant={fallbackVariant}
    >
      {children}
    </FeatureGate>
  );
}

/**
 * PremiumPlusGate - Shorthand for FeatureGate with PREMIUM_PLUS tier
 */
export function PremiumPlusGate({
  feature,
  description,
  children,
  fallback,
  fallbackVariant,
}: Omit<FeatureGateProps, 'requiredTier'>) {
  return (
    <FeatureGate
      requiredTier="PREMIUM_PLUS"
      feature={feature}
      description={description}
      fallback={fallback}
      fallbackVariant={fallbackVariant}
    >
      {children}
    </FeatureGate>
  );
}
