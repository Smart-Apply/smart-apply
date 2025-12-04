import { Injectable, ExecutionContext, Inject } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';
import { Reflector } from '@nestjs/core';
import { THROTTLER_NAME_KEY } from '../decorators/throttle.decorator';
import { AuditLoggerService } from '../audit-logger';

/**
 * Custom ThrottlerGuard that:
 * 1. Skips rate limiting in development (NODE_ENV === 'development')
 * 2. Supports named throttlers via @UseThrottler('name') decorator
 * 3. Logs rate limit violations for audit purposes
 *
 * Note: @nestjs/throttler v5 changed the storage API - it only has increment(),
 * not get(). We rely on the parent class for actual rate limiting logic.
 */
@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  constructor(
    protected readonly options: any,
    protected readonly storageService: any,
    protected readonly reflector: Reflector,
    @Inject(AuditLoggerService) private readonly auditLogger: AuditLoggerService,
  ) {
    super(options, storageService, reflector);
  }

  /**
   * Override canActivate to skip rate limiting in development and for health checks
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Skip rate limiting entirely in development for easier testing
    if (process.env.NODE_ENV === 'development') {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    
    // Skip rate limiting for health check endpoints (needed for Container Apps probes)
    if (request.url?.startsWith('/api/v1/health/')) {
      return true;
    }

    const response = context.switchToHttp().getResponse();

    try {
      // Call parent implementation which handles the actual rate limiting
      const result = await super.canActivate(context);

      // Add basic rate limit headers on success
      const throttlers = await this.getThrottlers(context);
      if (throttlers.length > 0) {
        const throttler = throttlers[0];
        response.setHeader('X-RateLimit-Limit', throttler.limit);
      }

      return result;
    } catch (error) {
      if (error instanceof ThrottlerException) {
        const throttlers = await this.getThrottlers(context);
        if (throttlers.length > 0) {
          const throttler = throttlers[0];
          const tracker = await this.getTracker(request);
          const user = request.user;

          // Log rate limit violation
          console.warn('[RateLimitGuard] Rate limit exceeded:', {
            endpoint: request.url,
            method: request.method,
            throttlerName: throttler.name,
            limit: throttler.limit,
            ttl: `${throttler.ttl}ms`,
            tracker,
            userId: user?.userId || 'anonymous',
          });

          this.auditLogger.logRateLimitViolation(user?.id, request.url, request);

          // Add rate limit headers
          response.setHeader('X-RateLimit-Limit', throttler.limit);
          response.setHeader('X-RateLimit-Remaining', '0');
          response.setHeader('Retry-After', Math.ceil(throttler.ttl / 1000));
        }
      }

      throw error;
    }
  }

  /**
   * Override to select which throttler configuration to use based on decorator
   */
  protected async getThrottlers(context: ExecutionContext) {
    // Check if a specific throttler is specified via decorator
    const throttlerName = this.reflector.getAllAndOverride<string>(THROTTLER_NAME_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Get all throttlers from options
    const throttlers = this.options.throttlers || [];

    // If a specific throttler is specified, return only that one
    if (throttlerName) {
      const namedThrottler = throttlers.find((t: any) => t.name === throttlerName);
      if (namedThrottler) {
        return [namedThrottler];
      }
    }

    // Otherwise return default throttler
    const defaultThrottler = throttlers.find((t: any) => t.name === 'default');
    return defaultThrottler ? [defaultThrottler] : [];
  }

  /**
   * Get tracker identifier (IP for public routes, user ID for authenticated routes)
   */
  protected async getTracker(req: Record<string, any>): Promise<string> {
    // For authenticated requests, use user ID
    if (req.user?.userId) {
      return `user:${req.user.userId}`;
    }

    // For public requests, use IP address
    return req.ip || req.connection?.remoteAddress || 'unknown';
  }

  /**
   * Generate a unique key for rate limiting
   */
  protected generateKey(context: ExecutionContext, tracker: string, throttlerName: string): string {
    const request = context.switchToHttp().getRequest();
    const route = `${request.method}-${request.route?.path || request.url}`;
    return `${throttlerName}:${route}:${tracker}`;
  }
}
