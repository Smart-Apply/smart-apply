'use client';

import { Infinity as InfinityIcon, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { useUsage, useUsagePeriod } from '@/hooks/use-usage';

interface UsageIndicatorProps {
  /** Type of action to show usage for */
  action: 'application' | 'interview';
  /** Whether to show the period info */
  showPeriod?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Custom class name */
  className?: string;
}

const sizeConfig = {
  sm: {
    text: 'text-xs',
    progress: 'h-1.5',
    icon: 'h-3 w-3',
  },
  md: {
    text: 'text-sm',
    progress: 'h-2',
    icon: 'h-4 w-4',
  },
  lg: {
    text: 'text-base',
    progress: 'h-2.5',
    icon: 'h-5 w-5',
  },
};

const actionLabels = {
  application: 'Bewerbungen',
  interview: 'Interview-Sessions',
};

/**
 * UsageIndicator - Shows usage progress for applications or interviews
 * 
 * @example
 * ```tsx
 * // Basic usage
 * <UsageIndicator action="application" />
 * 
 * // With period info
 * <UsageIndicator action="interview" showPeriod />
 * 
 * // Compact size
 * <UsageIndicator action="application" size="sm" />
 * ```
 */
export function UsageIndicator({
  action,
  showPeriod = false,
  size = 'md',
  className,
}: UsageIndicatorProps) {
  const { used, limit, remaining, percentage, isUnlimited, isExhausted, isLow, isLoading } =
    useUsage(action);
  const { periodLabel } = useUsagePeriod();

  const config = sizeConfig[size];
  const label = actionLabels[action];

  // Loading state
  if (isLoading) {
    return (
      <div className={cn('space-y-2 animate-pulse', className)}>
        <div className="flex justify-between">
          <div className="h-4 w-24 bg-muted rounded" />
          <div className="h-4 w-12 bg-muted rounded" />
        </div>
        <div className={cn('bg-muted rounded-full', config.progress)} />
      </div>
    );
  }

  // Unlimited tier
  if (isUnlimited) {
    return (
      <div className={cn('flex items-center gap-2', config.text, className)}>
        <InfinityIcon className={cn(config.icon, 'text-primary')} />
        <span className="text-muted-foreground">{label}:</span>
        <span className="font-medium text-primary">Unbegrenzt</span>
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      {/* Header with label and count */}
      <div className={cn('flex items-center justify-between', config.text)}>
        <span className="text-muted-foreground">{label}</span>
        <div className="flex items-center gap-2">
          {isLow && !isExhausted && (
            <AlertTriangle className={cn(config.icon, 'text-amber-500')} />
          )}
          <span
            className={cn(
              'font-medium',
              isExhausted && 'text-destructive',
              isLow && !isExhausted && 'text-amber-600 dark:text-amber-400'
            )}
          >
            {used} / {limit}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <Progress
        value={percentage}
        className={cn(
          config.progress,
          isExhausted && '[&>div]:bg-destructive',
          isLow && !isExhausted && '[&>div]:bg-amber-500'
        )}
      />

      {/* Remaining info */}
      <div className={cn('flex items-center justify-between', 'text-xs text-muted-foreground')}>
        <span>
          {isExhausted
            ? 'Limit erreicht'
            : `${remaining} verbleibend`}
        </span>
        {showPeriod && periodLabel && <span>{periodLabel}</span>}
      </div>
    </div>
  );
}

/**
 * UsageSummary - Shows usage for both applications and interviews
 * 
 * @example
 * ```tsx
 * <UsageSummary showPeriod />
 * ```
 */
export function UsageSummary({
  showPeriod = true,
  className,
}: {
  showPeriod?: boolean;
  className?: string;
}) {
  const { periodLabel } = useUsagePeriod();

  return (
    <div className={cn('space-y-4', className)}>
      {showPeriod && periodLabel && (
        <div className="text-xs text-muted-foreground text-center">
          Abrechnungszeitraum: {periodLabel}
        </div>
      )}
      <UsageIndicator action="application" />
      <UsageIndicator action="interview" />
    </div>
  );
}
