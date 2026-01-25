'use client';

import { Crown, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSubscription } from '@/hooks/use-subscription';
import type { SubscriptionTier } from '@/types';

interface TierBadgeProps {
  tier: SubscriptionTier;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
}

const tierConfig: Record<
  SubscriptionTier,
  {
    label: string;
    className: string;
    icon: typeof Crown | null;
  }
> = {
  FREE: {
    label: 'Free',
    className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    icon: null,
  },
  PREMIUM: {
    label: 'Premium',
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    icon: Crown,
  },
  PREMIUM_PLUS: {
    label: 'Premium+',
    className: 'bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 dark:from-purple-900/40 dark:to-pink-900/40 dark:text-purple-300',
    icon: Sparkles,
  },
};

const sizeConfig = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-2.5 py-1',
  lg: 'text-base px-3 py-1.5',
};

const iconSizeConfig = {
  sm: 'h-3 w-3',
  md: 'h-3.5 w-3.5',
  lg: 'h-4 w-4',
};

/**
 * TierBadge - Displays the user's subscription tier with appropriate styling
 * 
 * @example
 * ```tsx
 * <TierBadge tier="PREMIUM" />
 * <TierBadge tier="PREMIUM_PLUS" size="lg" />
 * <TierBadge tier="FREE" showIcon={false} />
 * ```
 */
export function TierBadge({
  tier,
  size = 'md',
  showIcon = true,
  className,
}: TierBadgeProps) {
  const config = tierConfig[tier];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium transition-colors',
        config.className,
        sizeConfig[size],
        className
      )}
    >
      {showIcon && Icon && (
        <Icon className={cn(iconSizeConfig[size], 'shrink-0')} />
      )}
      {config.label}
    </span>
  );
}

/**
 * Hook-connected TierBadge that automatically displays the current user's tier
 */
export function CurrentTierBadge({
  size = 'md',
  showIcon = true,
  className,
}: Omit<TierBadgeProps, 'tier'>) {
  const { tier, isLoading } = useSubscription();

  if (isLoading) {
    return (
      <span
        className={cn(
          'inline-flex items-center rounded-full bg-muted animate-pulse',
          sizeConfig[size],
          className
        )}
      >
        <span className="invisible">Loading</span>
      </span>
    );
  }

  return <TierBadge tier={tier} size={size} showIcon={showIcon} className={className} />;
}
