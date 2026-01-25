import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

/**
 * Request ID Middleware
 *
 * Generates and propagates unique request IDs for distributed tracing.
 * The request ID is used to correlate logs across the application lifecycle.
 *
 * Headers:
 * - X-Request-ID: If provided by client, will be used; otherwise generated
 * - X-Correlation-ID: Used for distributed tracing across services
 *
 * The request ID is:
 * 1. Taken from X-Request-ID header if provided
 * 2. Otherwise, taken from X-Correlation-ID header if provided
 * 3. Otherwise, a new UUID is generated
 *
 * The response will include the X-Request-ID header for client reference.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    // Use existing request ID from headers, or generate a new one
    const requestId =
      (req.headers['x-request-id'] as string) ||
      (req.headers['x-correlation-id'] as string) ||
      randomUUID();

    // Attach to request object for use in application code
    (req as any).id = requestId;

    // Set response header for client tracing
    res.setHeader('X-Request-ID', requestId);

    next();
  }
}
