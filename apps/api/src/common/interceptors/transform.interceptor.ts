import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Standard API response wrapper with data and metadata
 */
export interface ApiResponse<T> {
  data: T;
  meta: {
    timestamp: string;
    requestId?: string;
  };
}

/**
 * TransformInterceptor - Standardizes all API responses
 * 
 * Wraps controller responses in a consistent format:
 * {
 *   data: <controller response>,
 *   meta: {
 *     timestamp: ISO 8601 timestamp
 *   }
 * }
 * 
 * This interceptor is applied globally to all endpoints.
 * Errors are handled separately by AllExceptionsFilter.
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => ({
        data,
        meta: {
          timestamp: new Date().toISOString(),
        },
      })),
    );
  }
}
