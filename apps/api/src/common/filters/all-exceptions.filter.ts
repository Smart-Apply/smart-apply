import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

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

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      exceptionResponse = exception.getResponse();
    } else if (exception instanceof Error && exception.name === 'ForbiddenError') {
      // CSRF error from csrf-csrf middleware
      status = HttpStatus.FORBIDDEN;
      exceptionResponse = {
        message: exception.message || 'Invalid or missing CSRF token',
        code: 'EBADCSRFTOKEN',
      };
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      exceptionResponse = 'Internal server error';
    }

    // Extract detailed validation errors if available
    let message: any;
    let errors: any;
    let additionalData: any = {};

    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      message = (exceptionResponse as any).message || exceptionResponse;
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

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
      ...(errors && { errors }), // Include detailed errors if available
      ...additionalData, // Include additional metadata (e.g., applicationId)
    };

    // Log error details with validation errors
    const logMessage = `${request.method} ${request.url} - ${status}`;
    const logDetails = errors
      ? `Validation errors: ${JSON.stringify(errors, null, 2)}`
      : exception instanceof Error
        ? exception.stack
        : JSON.stringify(exception);

    // Don't log 401 errors as ERROR (normal auth flow with token refresh)
    if (status === HttpStatus.UNAUTHORIZED) {
      this.logger.debug(logMessage);
    } else {
      this.logger.error(logMessage, logDetails);
    }

    response.status(status).json(errorResponse);
  }
}
