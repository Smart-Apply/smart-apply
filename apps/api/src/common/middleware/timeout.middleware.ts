import { Injectable, NestMiddleware, RequestTimeoutException, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '../../config/config.service';

/**
 * Global request timeout middleware
 * 
 * Prevents hanging requests from tying up worker threads indefinitely.
 * Throws RequestTimeoutException (408) if request exceeds configured timeout.
 * 
 * Configuration:
 * - REQUEST_TIMEOUT_MS: Global timeout in milliseconds (default: 30000 = 30s)
 * 
 * Use cases:
 * - LLM requests that hang (circuit breaker handles degraded service, this handles total failure)
 * - Database queries that lock indefinitely
 * - External API calls that never respond
 * - PDF generation that runs too long
 * 
 * Important:
 * - Applied globally to all routes (can exclude specific routes if needed)
 * - Clears timeout on response finish to prevent memory leaks
 * - Does NOT interrupt async operations (only prevents response)
 */
@Injectable()
export class TimeoutMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TimeoutMiddleware.name);
  private readonly timeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    this.timeoutMs = this.configService.requestTimeoutMs;
    this.logger.log(`⏱️  Global request timeout: ${this.timeoutMs}ms`);
  }

  use(req: Request, res: Response, next: NextFunction) {
    // Set timeout for this request
    const timeout = setTimeout(() => {
      // Only throw if response hasn't been sent yet
      if (!res.headersSent) {
        this.logger.warn(
          `Request timeout after ${this.timeoutMs}ms: ${req.method} ${req.path}`,
        );
        
        // Clear the timeout to prevent memory leak
        clearTimeout(timeout);
        
        // Throw RequestTimeoutException (will be caught by global exception filter)
        throw new RequestTimeoutException(
          `Request timeout after ${this.timeoutMs / 1000}s. The server is taking too long to process your request. Please try again.`,
        );
      }
    }, this.timeoutMs);

    // Clear timeout when response finishes
    res.on('finish', () => {
      clearTimeout(timeout);
    });

    // Clear timeout on error
    res.on('error', () => {
      clearTimeout(timeout);
    });

    next();
  }
}
