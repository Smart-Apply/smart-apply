import { SetMetadata, applyDecorators } from '@nestjs/common';
import { SubscriptionTier } from '../../generated/prisma/client';

/**
 * Metadata keys for guards
 */
export const REQUIRED_TIER_KEY = 'requiredTier';
export const USAGE_ACTION_KEY = 'usageAction';

/**
 * Usage action types
 */
export type UsageAction = 'application' | 'interview';

/**
 * RequiresTier Decorator
 *
 * Marks an endpoint as requiring a specific subscription tier.
 * Used with TierGuard to restrict access based on tier level.
 *
 * Tier hierarchy: FREE < PREMIUM < PREMIUM_PLUS
 * A user with PREMIUM_PLUS can access PREMIUM-only endpoints.
 *
 * @example
 * @UseGuards(JwtAuthGuard, TierGuard)
 * @RequiresTier(SubscriptionTier.PREMIUM)
 * async premiumFeature() { ... }
 */
export const RequiresTier = (tier: SubscriptionTier) => SetMetadata(REQUIRED_TIER_KEY, tier);

/**
 * RequiresPremium Decorator (Shorthand)
 *
 * Shorthand for @RequiresTier(SubscriptionTier.PREMIUM)
 *
 * @example
 * @UseGuards(JwtAuthGuard, TierGuard)
 * @RequiresPremium()
 * async premiumFeature() { ... }
 */
export const RequiresPremium = () => RequiresTier(SubscriptionTier.PREMIUM);

/**
 * RequiresPremiumPlus Decorator (Shorthand)
 *
 * Shorthand for @RequiresTier(SubscriptionTier.PREMIUM_PLUS)
 *
 * @example
 * @UseGuards(JwtAuthGuard, TierGuard)
 * @RequiresPremiumPlus()
 * async premiumPlusFeature() { ... }
 */
export const RequiresPremiumPlus = () => RequiresTier(SubscriptionTier.PREMIUM_PLUS);

/**
 * CheckUsage Decorator
 *
 * Marks an endpoint to check usage limits for a specific action.
 * Used with UsageLimitGuard to enforce monthly quotas.
 *
 * @example
 * @UseGuards(JwtAuthGuard, UsageLimitGuard)
 * @CheckUsage('application')
 * async createApplication() { ... }
 */
export const CheckUsage = (action: UsageAction) => SetMetadata(USAGE_ACTION_KEY, action);

/**
 * PremiumFeature Decorator (Combined)
 *
 * Combines @RequiresPremium() and optionally @CheckUsage().
 * Useful for premium-only features that also have usage limits.
 *
 * Note: You still need to apply the guards yourself:
 * @UseGuards(JwtAuthGuard, TierGuard, UsageLimitGuard)
 *
 * @example
 * // Premium required, no usage limit
 * @UseGuards(JwtAuthGuard, TierGuard)
 * @PremiumFeature()
 * async premiumFeature() { ... }
 *
 * @example
 * // Premium required + interview usage limit
 * @UseGuards(JwtAuthGuard, TierGuard, UsageLimitGuard)
 * @PremiumFeature('interview')
 * async startInterview() { ... }
 */
export const PremiumFeature = (action?: UsageAction) => {
  const decorators: Array<ClassDecorator | MethodDecorator | PropertyDecorator> = [
    RequiresPremium(),
  ];
  if (action) {
    decorators.push(CheckUsage(action));
  }
  return applyDecorators(...decorators);
};

/**
 * PremiumPlusFeature Decorator (Combined)
 *
 * Combines @RequiresPremiumPlus() for Premium Plus-only features.
 *
 * @example
 * @UseGuards(JwtAuthGuard, TierGuard)
 * @PremiumPlusFeature()
 * async exclusiveFeature() { ... }
 */
export const PremiumPlusFeature = () => {
  return applyDecorators(RequiresPremiumPlus());
};
