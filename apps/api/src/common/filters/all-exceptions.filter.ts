import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorCode, getErrorMessage } from '../constants/error-codes';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Handle CSRF errors (ForbiddenError from csrf-csrf package)
    let status: number;
    let exceptionResponse: any;
    let errorCode: string | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      exceptionResponse = exception.getResponse();
    } else if (exception instanceof Error && exception.name === 'ForbiddenError') {
      // CSRF error from csrf-csrf middleware
      status = HttpStatus.FORBIDDEN;
      errorCode = 'EBADCSRFTOKEN';
      exceptionResponse = {
        message: exception.message || 'Invalid or missing CSRF token',
        code: errorCode,
      };
    } else {
      // Internal server error - don't leak details to client
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      errorCode = ErrorCode.INTERNAL_SERVER_ERROR;
      exceptionResponse = {
        code: errorCode,
        message: getErrorMessage(errorCode),
      };
    }

    // Extract detailed validation errors if available
    let message: any;
    let errors: any;
    let additionalData: any = {};

    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      // Extract error code (either from coded exception or custom code field)
      errorCode = (exceptionResponse as any).code || errorCode;
      
      // Get message - prefer custom message, fallback to code-based message
      const customMessage = (exceptionResponse as any).message;
      message = customMessage || (errorCode ? getErrorMessage(errorCode) : exceptionResponse);
      
      // Extract validation errors
      errors = (exceptionResponse as any).errors;
      
      // Extract any additional metadata (e.g., applicationId for conflict errors)
      if (exception instanceof HttpException) {
        const exceptionObj = exception as any;
        if (exceptionObj.applicationId) {
          additionalData.applicationId = exceptionObj.applicationId;
        }
      }
    } else {
      message = exceptionResponse;
    }

    // Add default error codes for standard HTTP exceptions without explicit codes
    if (!errorCode) {
      switch (status) {
        case HttpStatus.BAD_REQUEST:
          errorCode = ErrorCode.VALIDATION_ERROR;
          break;
        case HttpStatus.UNAUTHORIZED:
          errorCode = ErrorCode.UNAUTHORIZED;
          break;
        case HttpStatus.FORBIDDEN:
          errorCode = ErrorCode.FORBIDDEN;
          break;
        case HttpStatus.NOT_FOUND:
          errorCode = ErrorCode.NOT_FOUND;
          break;
        case HttpStatus.TOO_MANY_REQUESTS:
          errorCode = ErrorCode.RATE_LIMIT_EXCEEDED;
          break;
        case HttpStatus.INTERNAL_SERVER_ERROR:
          errorCode = ErrorCode.INTERNAL_SERVER_ERROR;
          break;
      }
    }

    const timestamp = new Date().toISOString();
    
    const errorResponse = {
      statusCode: status,
      message,
      ...(errorCode && { code: errorCode }), // Include error code
      ...(errors && { errors }), // Include detailed errors if available
      ...additionalData, // Include additional metadata (e.g., applicationId)
      meta: {
        timestamp,
        path: request.url,
        method: request.method,
      },
    };

    // Log error details
    // For 500 errors, log full stack trace server-side but don't send to client
    const logMessage = `${request.method} ${request.url} - ${status}${errorCode ? ` [${errorCode}]` : ''}`;
    const logDetails = errors
      ? `Validation errors: ${JSON.stringify(errors, null, 2)}`
      : exception instanceof Error
        ? exception.stack
        : JSON.stringify(exception);

    // Don't log 401 errors as ERROR (normal auth flow with token refresh)
    if (status === HttpStatus.UNAUTHORIZED) {
      this.logger.debug(logMessage);
    } else if (status >= 500) {
      // Log full error details for 500 errors
      this.logger.error(`${logMessage}\n${logDetails}`);
    } else {
      this.logger.warn(logMessage, logDetails);
    }

    response.status(status).json(errorResponse);
  }
}
