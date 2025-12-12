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
 * 4. Exposes comprehensive rate limit headers (X-RateLimit-*)
 *
 * Note: @nestjs/throttler v5 changed the storage API - it only has increment(),
 * not get(). We override handleRequest to track hits and set headers.
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

    // Call parent implementation which calls handleRequest for each throttler
    return super.canActivate(context);
  }

  /**
   * Override handleRequest to add comprehensive rate limit headers
   * This is called by the parent's canActivate method for each throttler
   */
  protected async handleRequest(
    context: ExecutionContext,
    limit: number,
    ttl: number,
    throttler: any,
  ): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const tracker = await this.getTracker(request);
    const key = this.generateKey(context, tracker, throttler.name || 'default');

    try {
      // Increment counter and get total hits
      const { totalHits } = await this.storageService.increment(key, ttl);

      // Check if limit exceeded
      if (totalHits > limit) {
        const user = request.user;

        // Log rate limit violation
        console.warn('[RateLimitGuard] Rate limit exceeded:', {
          endpoint: request.url,
          method: request.method,
          throttlerName: throttler.name,
          limit,
          ttl: `${ttl}ms`,
          tracker,
          userId: user?.userId || 'anonymous',
          totalHits,
        });

        this.auditLogger.logRateLimitViolation(user?.id, request.url, request);

        // Set rate limit headers for exceeded limit
        response.setHeader('X-RateLimit-Limit', limit.toString());
        response.setHeader('X-RateLimit-Remaining', '0');
        response.setHeader('X-RateLimit-Reset', (Date.now() + ttl).toString());
        response.setHeader('Retry-After', Math.ceil(ttl / 1000).toString());

        // Throw exception to trigger 429 response
        throw new ThrottlerException();
      }

      // Calculate remaining requests
      const remaining = Math.max(0, limit - totalHits);

      // Set comprehensive rate limit headers on success
      response.setHeader('X-RateLimit-Limit', limit.toString());
      response.setHeader('X-RateLimit-Remaining', remaining.toString());
      response.setHeader('X-RateLimit-Reset', (Date.now() + ttl).toString());

      return true;
    } catch (error) {
      // Re-throw ThrottlerException to trigger 429 response
      if (error instanceof ThrottlerException) {
        throw error;
      }
      // For other errors, log and re-throw
      console.error('[RateLimitGuard] Error in handleRequest:', error);
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
