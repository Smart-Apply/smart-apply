import { Injectable, ExecutionContext, Inject } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException, ThrottlerRequest } from '@nestjs/throttler';
import { Reflector } from '@nestjs/core';
import { THROTTLER_NAME_KEY } from '../decorators/throttle.decorator';
import { AuditLoggerService } from '../audit-logger';

// NestJS Throttler internal constants
const THROTTLER_SKIP = 'THROTTLER:SKIP';

/**
 * Custom ThrottlerGuard that:
 * 1. Skips rate limiting in development (NODE_ENV === 'development')
 * 2. Uses ONLY ONE throttler per request (default or named via @UseThrottler)
 * 3. Logs rate limit violations for audit purposes
 * 4. Exposes comprehensive rate limit headers (X-RateLimit-*)
 *
 * IMPORTANT: Unlike the default ThrottlerGuard which applies ALL throttlers,
 * this guard applies only the DEFAULT throttler unless @UseThrottler('name')
 * explicitly specifies a different one. This prevents the strict 'auth' throttler
 * from being applied to all endpoints.
 *
 * Note: @nestjs/throttler v6 changed the handleRequest signature to use ThrottlerRequest
 */
@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  @Inject(AuditLoggerService)
  private readonly auditLogger: AuditLoggerService;

  /**
   * Override canActivate to:
   * 1. Skip rate limiting in development
   * 2. Skip for health checks
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Skip rate limiting entirely in development for easier testing
    if (process.env.NODE_ENV === 'development') {
      return true;
    }

    const request = context.switchToHttp().getRequest();

    // Skip rate limiting for health check endpoints (needed for Container Apps probes)
    // Match both /api/v1/health and /api/v1/health/* paths
    if (request.url?.startsWith('/api/v1/health')) {
      return true;
    }

    // Check if @SkipThrottle() is applied at handler or class level
    const handler = context.getHandler();
    const classRef = context.getClass();
    const shouldSkip = this.reflector.getAllAndOverride<boolean>(THROTTLER_SKIP, [
      handler,
      classRef,
    ]);

    if (shouldSkip) {
      return true;
    }

    // Call parent's canActivate which will call handleRequest
    return super.canActivate(context);
  }

  /**
   * Override handleRequest with the new v6 signature (ThrottlerRequest)
   * This is called by the parent's canActivate method for each throttler
   */
  protected async handleRequest(requestProps: ThrottlerRequest): Promise<boolean> {
    const { context, limit, ttl, throttler, blockDuration } = requestProps;
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const tracker = await this.getTracker(request);
    const key = this.generateKey(context, tracker, throttler.name || 'default');

    // Convert ttl to milliseconds if it's in seconds
    const ttlMs = ttl < 1000 ? ttl * 1000 : ttl;

    try {
      // Increment counter and get total hits
      const { totalHits } = await this.storageService.increment(
        key,
        ttlMs,
        limit,
        blockDuration,
        throttler.name || 'default',
      );

      // Check if limit exceeded
      if (totalHits > limit) {
        const user = request.user;

        // Log rate limit violation
        console.warn('[RateLimitGuard] Rate limit exceeded:', {
          endpoint: request.url,
          method: request.method,
          throttlerName: throttler.name,
          limit,
          ttl: `${ttlMs}ms`,
          tracker,
          userId: user?.userId || 'anonymous',
          totalHits,
        });

        this.auditLogger.logRateLimitViolation(user?.id, request.url, request);

        // Set rate limit headers for exceeded limit
        response.setHeader('X-RateLimit-Limit', limit.toString());
        response.setHeader('X-RateLimit-Remaining', '0');
        response.setHeader('X-RateLimit-Reset', (Date.now() + ttlMs).toString());
        response.setHeader('Retry-After', Math.ceil(ttlMs / 1000).toString());

        // Throw exception to trigger 429 response
        throw new ThrottlerException();
      }

      // Calculate remaining requests
      const remaining = Math.max(0, limit - totalHits);

      // Set comprehensive rate limit headers on success
      response.setHeader('X-RateLimit-Limit', limit.toString());
      response.setHeader('X-RateLimit-Remaining', remaining.toString());
      response.setHeader('X-RateLimit-Reset', (Date.now() + ttlMs).toString());

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
