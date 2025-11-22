import { Injectable, ExecutionContext, Inject } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';
import { Reflector } from '@nestjs/core';
import { THROTTLER_NAME_KEY } from '../decorators/throttle.decorator';
import { AuditLoggerService } from '../audit-logger';

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
   * Override canActivate to add rate limit headers to response
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const response = context.switchToHttp().getResponse();
    const request = context.switchToHttp().getRequest();

    try {
      // Get the throttlers that will be applied
      const throttlers = await this.getThrottlers(context);

      // Call parent implementation
      const result = await super.canActivate(context);

      // Add rate limit headers after successful check
      if (throttlers.length > 0) {
        const throttler = throttlers[0];
        const tracker = await this.getTracker(request);
        const key = this.generateKey(context, tracker, throttler.name || 'default');

        // Get the current state from storage
        try {
          const record = await this.storageService.get(key);
          if (record) {
            const limit = throttler.limit;
            response.setHeader('X-RateLimit-Limit', limit);
            response.setHeader('X-RateLimit-Remaining', Math.max(0, limit - record.totalHits));
            response.setHeader(
              'X-RateLimit-Reset',
              new Date(Date.now() + record.timeToExpire).getTime(),
            );
          }
        } catch (e) {
          // Ignore errors when getting storage state
        }
      }

      return result;
    } catch (error) {
      // Add headers even on error
      const throttlers = await this.getThrottlers(context);
      if (throttlers.length > 0) {
        const throttler = throttlers[0];
        response.setHeader('X-RateLimit-Limit', throttler.limit);
        response.setHeader('X-RateLimit-Remaining', '0');

        if (error instanceof ThrottlerException) {
          // Log rate limit violation
          const user = request.user;
          this.auditLogger.logRateLimitViolation(user?.id, request.url, request);
          
          // Add Retry-After header
          response.setHeader('Retry-After', Math.ceil(throttler.ttl / 1000));
        }
      }

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

    // For public requests (auth endpoints), use IP address
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
