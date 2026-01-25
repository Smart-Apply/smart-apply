import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SubscriptionService } from '../../subscription/subscription.service';
import { SubscriptionTier } from '../../generated/prisma/client';
import { REQUIRED_TIER_KEY } from '../decorators/tier.decorator';

/**
 * TierGuard
 *
 * Checks if the authenticated user has the required subscription tier
 * to access a protected resource. Uses the @RequiresTier() decorator
 * to determine the minimum tier required.
 *
 * Tier hierarchy: FREE < PREMIUM < PREMIUM_PLUS
 *
 * Usage:
 * @UseGuards(JwtAuthGuard, TierGuard)
 * @RequiresTier(SubscriptionTier.PREMIUM)
 * async premiumOnlyEndpoint() {}
 */
@Injectable()
export class TierGuard implements CanActivate {
  private readonly logger = new Logger(TierGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get required tier from decorator metadata
    const requiredTier = this.reflector.getAllAndOverride<SubscriptionTier>(REQUIRED_TIER_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No tier required = public endpoint
    if (!requiredTier) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // User must be authenticated (JwtAuthGuard should run first)
    if (!user) {
      this.logger.warn('TierGuard: No user found in request. Ensure JwtAuthGuard runs first.');
      throw new UnauthorizedException('Authentifizierung erforderlich');
    }

    // Check if user has required tier
    const hasTier = await this.subscriptionService.hasTier(user.id, requiredTier);

    if (!hasTier) {
      const currentTier = await this.subscriptionService.getUserTier(user.id);

      this.logger.debug(
        `User ${user.id} with tier ${currentTier} denied access to ${requiredTier} resource`,
      );

      throw new ForbiddenException({
        message: 'Diese Funktion erfordert ein Upgrade',
        error: 'TIER_REQUIRED',
        requiredTier,
        currentTier,
        upgradeUrl: '/pricing',
      });
    }

    return true;
  }
}
