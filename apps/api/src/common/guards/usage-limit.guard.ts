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
import { USAGE_ACTION_KEY, UsageAction } from '../decorators/tier.decorator';

/**
 * UsageLimitGuard
 *
 * Checks if the authenticated user has remaining usage quota
 * for the specified action. Uses the @CheckUsage() decorator
 * to determine which action to check.
 *
 * Actions:
 * - 'application': Creating new job applications
 * - 'interview': Starting interview coaching sessions
 *
 * Usage:
 * @UseGuards(JwtAuthGuard, UsageLimitGuard)
 * @CheckUsage('application')
 * async createApplication() {}
 */
@Injectable()
export class UsageLimitGuard implements CanActivate {
  private readonly logger = new Logger(UsageLimitGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get usage action from decorator metadata
    const action = this.reflector.get<UsageAction>(USAGE_ACTION_KEY, context.getHandler());

    // No action specified = no usage check needed
    if (!action) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // User must be authenticated (JwtAuthGuard should run first)
    if (!user) {
      this.logger.warn(
        'UsageLimitGuard: No user found in request. Ensure JwtAuthGuard runs first.',
      );
      throw new UnauthorizedException('Authentifizierung erforderlich');
    }

    // Check if user can perform the action
    const result = await this.subscriptionService.canPerformAction(user.id, action);

    if (!result.allowed) {
      this.logger.debug(`User ${user.id} denied ${action}: ${result.reason}`);

      throw new ForbiddenException({
        message: result.reason,
        error: 'USAGE_LIMIT_EXCEEDED',
        action,
        remaining: result.remaining,
        limit: result.limit,
        upgradeUrl: '/pricing',
      });
    }

    // Attach remaining count to request for response interceptor
    request.usageRemaining = result.remaining;
    request.usageLimit = result.limit;
    request.usageAction = action;

    return true;
  }
}
