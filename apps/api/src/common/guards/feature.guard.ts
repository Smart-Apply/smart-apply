import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SubscriptionService, TierLimits } from '../../subscription/subscription.service';
import { REQUIRED_FEATURE_KEY, FeatureFlag } from '../decorators/tier.decorator';

/**
 * FeatureGuard
 *
 * Checks if the authenticated user has access to a specific feature
 * based on their subscription tier. Uses the @RequiresFeature() decorator
 * to determine which feature is required.
 *
 * Usage:
 * @UseGuards(JwtAuthGuard, FeatureGuard)
 * @RequiresFeature('pdfExport')
 * async downloadPdf() {}
 */
@Injectable()
export class FeatureGuard implements CanActivate {
  private readonly logger = new Logger(FeatureGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get required feature from decorator metadata
    const requiredFeature = this.reflector.getAllAndOverride<FeatureFlag>(REQUIRED_FEATURE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No feature required = public endpoint
    if (!requiredFeature) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // User must be authenticated (JwtAuthGuard should run first)
    if (!user) {
      this.logger.warn('FeatureGuard: No user found in request. Ensure JwtAuthGuard runs first.');
      throw new UnauthorizedException('Authentifizierung erforderlich');
    }

    // Check if user's tier has the required feature
    const hasFeature = await this.subscriptionService.hasFeature(
      user.id,
      requiredFeature as keyof TierLimits['features'],
    );

    if (!hasFeature) {
      const currentTier = await this.subscriptionService.getUserTier(user.id);

      this.logger.debug(
        `User ${user.id} with tier ${currentTier} denied access to feature ${requiredFeature}`,
      );

      // Determine which tier is required for this feature
      const requiredTier = this.getRequiredTierForFeature(requiredFeature);

      throw new ForbiddenException({
        message: `Diese Funktion erfordert ein ${requiredTier}-Abonnement`,
        error: 'FEATURE_REQUIRED',
        requiredFeature,
        requiredTier,
        currentTier,
        upgradeUrl: '/pricing',
      });
    }

    return true;
  }

  /**
   * Determine which tier is required for a specific feature
   */
  private getRequiredTierForFeature(feature: FeatureFlag): string {
    // Features available in PRO (and PREMIUM)
    const proFeatures: FeatureFlag[] = [
      'pdfExport',
      'multipleTemplates',
      'atsOptimization',
      'basicAnalytics',
      'extendedProfile',
      'linkedinImport',
      'noAds',
    ];

    // Features only available in PREMIUM
    const premiumFeatures: FeatureFlag[] = [
      'premiumTemplates',
      'customBranding',
      'advancedAnalytics',
      'interviewCoach',
      'autoApplyAgent',
      'emailParsing',
      'prioritySupport',
    ];

    if (premiumFeatures.includes(feature)) {
      return 'Premium';
    }
    if (proFeatures.includes(feature)) {
      return 'Pro';
    }
    return 'Pro'; // Default
  }
}
