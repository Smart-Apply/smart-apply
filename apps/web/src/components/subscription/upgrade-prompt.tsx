'use client';

import { useRouter } from 'next/navigation';
import { Lock, ArrowRight, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { SubscriptionTier } from '@/types';

interface UpgradePromptProps {
  /** Name of the feature being restricted */
  feature: string;
  /** Tier required to access this feature */
  requiredTier: SubscriptionTier;
  /** Optional description explaining what the feature does */
  description?: string;
  /** Optional custom CTA text */
  ctaText?: string;
  /** Custom class name */
  className?: string;
  /** Variant style */
  variant?: 'default' | 'compact' | 'inline';
}

/**
 * UpgradePrompt - Shows when a user tries to access a premium feature
 * 
 * @example
 * ```tsx
 * // Default full-size prompt
 * <UpgradePrompt
 *   feature="Interview Coach"
 *   requiredTier="PREMIUM"
 *   description="Übe mit unserem KI-gestützten Interview Coach"
 * />
 * 
 * // Compact inline version
 * <UpgradePrompt
 *   feature="Unbegrenzte Bewerbungen"
 *   requiredTier="PREMIUM_PLUS"
 *   variant="compact"
 * />
 * ```
 */
export function UpgradePrompt({
  feature,
  requiredTier,
  description,
  ctaText,
  className,
  variant = 'default',
}: UpgradePromptProps) {
  const router = useRouter();

  const tierLabel = requiredTier === 'PREMIUM' ? 'Premium' : 'Premium+';
  const defaultCta = `Upgrade auf ${tierLabel}`;

  const handleUpgrade = () => {
    router.push('/pricing');
  };

  // Inline variant - minimal styling
  if (variant === 'inline') {
    return (
      <div
        className={cn(
          'flex items-center gap-2 text-sm text-muted-foreground',
          className
        )}
      >
        <Lock className="h-4 w-4 text-amber-500" />
        <span>
          {feature} benötigt {tierLabel}.{' '}
          <button
            onClick={handleUpgrade}
            className="text-primary hover:underline font-medium"
          >
            Jetzt upgraden
          </button>
        </span>
      </div>
    );
  }

  // Compact variant - smaller card
  if (variant === 'compact') {
    return (
      <div
        className={cn(
          'flex items-center justify-between gap-4 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20',
          className
        )}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
            <Lock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="font-medium text-foreground">{feature}</p>
            <p className="text-sm text-muted-foreground">
              Nur mit {tierLabel} verfügbar
            </p>
          </div>
        </div>
        <Button size="sm" onClick={handleUpgrade}>
          {ctaText || defaultCta}
        </Button>
      </div>
    );
  }

  // Default variant - full card
  return (
    <Card
      className={cn(
        'overflow-hidden border-amber-200 dark:border-amber-900/50',
        className
      )}
    >
      <CardContent className="p-0">
        {/* Gradient header */}
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 px-6 py-8 dark:from-amber-950/30 dark:to-orange-950/30">
          <div className="flex items-center justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/50 dark:to-orange-900/50">
              <Sparkles className="h-8 w-8 text-amber-600 dark:text-amber-400" />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-4 p-6 text-center">
          <div className="space-y-2">
            <h3 className="text-xl font-semibold text-foreground">
              {feature}
            </h3>
            {description && (
              <p className="text-muted-foreground">{description}</p>
            )}
            <p className="text-sm text-muted-foreground">
              Dieses Feature ist nur mit{' '}
              <span className="font-medium text-amber-600 dark:text-amber-400">
                {tierLabel}
              </span>{' '}
              verfügbar.
            </p>
          </div>

          <Button onClick={handleUpgrade} className="w-full" size="lg">
            <Sparkles className="mr-2 h-4 w-4" />
            {ctaText || defaultCta}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * LimitReachedPrompt - Shows when user has exhausted their monthly quota
 */
interface LimitReachedPromptProps {
  /** Type of action that is limited */
  action: 'application' | 'interview';
  /** Number of items used */
  used: number;
  /** Maximum limit */
  limit: number;
  /** Custom class name */
  className?: string;
}

export function LimitReachedPrompt({
  action,
  used,
  limit,
  className,
}: LimitReachedPromptProps) {
  const router = useRouter();

  const actionLabel = action === 'application' ? 'Bewerbungen' : 'Interview-Sessions';

  return (
    <Card
      className={cn(
        'border-destructive/50 bg-destructive/5',
        className
      )}
    >
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
            <Lock className="h-5 w-5 text-destructive" />
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <h3 className="font-semibold text-foreground">
                Monatliches Limit erreicht
              </h3>
              <p className="text-sm text-muted-foreground">
                Du hast {used} von {limit} {actionLabel} diesen Monat verwendet.
                Upgrade für mehr Kapazität.
              </p>
            </div>
            <Button onClick={() => router.push('/pricing')} size="sm">
              <Sparkles className="mr-2 h-4 w-4" />
              Jetzt upgraden
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
