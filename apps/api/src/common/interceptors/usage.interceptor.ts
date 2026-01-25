import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * UsageInterceptor
 * Adds usage information to response headers after successful requests.
 * Works in conjunction with UsageLimitGuard which attaches usage data
 * to the request object.
 * Response Headers Added:
 * - X-Usage-Remaining: Number of remaining actions (or "unlimited")
 * - X-Usage-Limit: Total limit for the action (or "unlimited")
 * - X-Usage-Action: The action type that was tracked
 * Usage:
 * @UseInterceptors(UsageInterceptor)
 * @UseGuards(JwtAuthGuard, UsageLimitGuard)
 * @CheckUsage('application')
 * async createApplication() { ... }
 */
@Injectable()
export class UsageInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((data) => {
        const request = context.switchToHttp().getRequest();
        const response = context.switchToHttp().getResponse();

        // Add usage info to response headers if available
        // (set by UsageLimitGuard)
        if (request.usageRemaining !== undefined) {
          const remaining =
            request.usageRemaining === -1 ? 'unlimited' : String(request.usageRemaining);
          response.setHeader('X-Usage-Remaining', remaining);
        }

        if (request.usageLimit !== undefined) {
          const limit = request.usageLimit === -1 ? 'unlimited' : String(request.usageLimit);
          response.setHeader('X-Usage-Limit', limit);
        }

        if (request.usageAction) {
          response.setHeader('X-Usage-Action', request.usageAction);
        }

        return data;
      }),
    );
  }
}
