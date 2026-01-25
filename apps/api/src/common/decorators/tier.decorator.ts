import { SetMetadata, applyDecorators } from '@nestjs/common';
import { SubscriptionTier } from '../../generated/prisma/client';

/**
 * Metadata keys for guards
 */
export const REQUIRED_TIER_KEY = 'requiredTier';
export const USAGE_ACTION_KEY = 'usageAction';
export const REQUIRED_FEATURE_KEY = 'requiredFeature';

/**
 * Usage action types
 * - coverLetter: KI cover letter generation
 * - resume: KI resume generation
 * - jobParsing: URL/text job parsing
 * - interview: Interview coaching sessions
 */
export type UsageAction = 'coverLetter' | 'resume' | 'jobParsing' | 'interview';

/**
 * Feature flags that can be checked
 */
export type FeatureFlag =
  | 'pdfExport'
  | 'multipleTemplates'
  | 'premiumTemplates'
  | 'customBranding'
  | 'atsOptimization'
  | 'basicAnalytics'
  | 'advancedAnalytics'
  | 'extendedProfile'
  | 'linkedinImport'
  | 'interviewCoach'
  | 'autoApplyAgent'
  | 'emailParsing'
  | 'prioritySupport'
  | 'noAds';

/**
 * RequiresTier Decorator
 *
 * Marks an endpoint as requiring a specific subscription tier.
 * Used with TierGuard to restrict access based on tier level.
 *
 * Tier hierarchy: FREE < PRO < PREMIUM
 * A user with PREMIUM can access PRO-only endpoints.
 *
 * @example
 * @UseGuards(JwtAuthGuard, TierGuard)
 * @RequiresTier(SubscriptionTier.PRO)
 * async proFeature() { ... }
 */
export const RequiresTier = (tier: SubscriptionTier) => SetMetadata(REQUIRED_TIER_KEY, tier);

/**
 * RequiresPro Decorator (Shorthand)
 *
 * Shorthand for @RequiresTier(SubscriptionTier.PRO)
 * Requires at least Pro tier (Pro or Premium users can access)
 *
 * @example
 * @UseGuards(JwtAuthGuard, TierGuard)
 * @RequiresPro()
 * async proFeature() { ... }
 */
export const RequiresPro = () => RequiresTier(SubscriptionTier.PRO);

/**
 * RequiresPremium Decorator (Shorthand)
 *
 * Shorthand for @RequiresTier(SubscriptionTier.PREMIUM)
 * Requires Premium tier (only Premium users can access)
 *
 * @example
 * @UseGuards(JwtAuthGuard, TierGuard)
 * @RequiresPremium()
 * async premiumFeature() { ... }
 */
export const RequiresPremium = () => RequiresTier(SubscriptionTier.PREMIUM);

/**
 * @deprecated Use RequiresPremium() instead
 * Kept for backward compatibility
 */
export const RequiresPremiumPlus = () => RequiresTier(SubscriptionTier.PREMIUM);

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
 * RequiresFeature Decorator
 *
 * Marks an endpoint as requiring a specific feature flag.
 * Used with FeatureGuard to check if user's tier has the feature.
 *
 * @example
 * @UseGuards(JwtAuthGuard, FeatureGuard)
 * @RequiresFeature('pdfExport')
 * async downloadPdf() { ... }
 */
export const RequiresFeature = (feature: FeatureFlag) =>
  SetMetadata(REQUIRED_FEATURE_KEY, feature);

/**
 * ProFeature Decorator (Combined)
 *
 * Combines @RequiresPro() and optionally @CheckUsage().
 * Useful for Pro-tier features that may have usage limits.
 *
 * Note: You still need to apply the guards yourself:
 * @UseGuards(JwtAuthGuard, TierGuard, UsageLimitGuard)
 *
 * @example
 * // Pro required, no usage limit
 * @UseGuards(JwtAuthGuard, TierGuard)
 * @ProFeature()
 * async proFeature() { ... }
 *
 * @example
 * // Pro required + cover letter usage limit
 * @UseGuards(JwtAuthGuard, TierGuard, UsageLimitGuard)
 * @ProFeature('coverLetter')
 * async generateCoverLetter() { ... }
 */
export const ProFeature = (action?: UsageAction) => {
  const decorators: Array<ClassDecorator | MethodDecorator | PropertyDecorator> = [RequiresPro()];
  if (action) {
    decorators.push(CheckUsage(action));
  }
  return applyDecorators(...decorators);
};

/**
 * PremiumFeature Decorator (Combined)
 *
 * Combines @RequiresPremium() and optionally @CheckUsage().
 * Useful for Premium-only features that also have usage limits.
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
 * @deprecated Use PremiumFeature() instead
 * Kept for backward compatibility
 */
export const PremiumPlusFeature = () => {
  return applyDecorators(RequiresPremium());
};
