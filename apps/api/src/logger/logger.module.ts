import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { ConfigService } from '../config/config.service';
import { ConfigModule } from '../config/config.module';
import { Request, Response } from 'express';

/**
 * Logger Module - Configures structured logging with Pino
 *
 * Features:
 * - Structured JSON logs in production for easy parsing by log aggregators
 * - Pretty-printed logs in development for better developer experience
 * - Automatic redaction of sensitive data (passwords, tokens, API keys)
 * - Request ID propagation for distributed tracing
 * - User ID enrichment for authenticated requests
 * - Health check endpoint exclusion to reduce log noise
 *
 * Log Levels:
 * - trace: Very detailed debugging (not used in production)
 * - debug: Debugging information
 * - info: General informational messages (default)
 * - warn: Warning messages
 * - error: Error messages with stack traces
 * - fatal: Fatal errors that cause app crash
 *
 * Environment Variables:
 * - LOG_LEVEL: Set the minimum log level (default: 'info')
 *
 * @see https://getpino.io/ - Pino documentation
 * @see https://github.com/iamolegga/nestjs-pino - NestJS Pino integration
 */
@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          // Set log level from environment variable
          level: config.logLevel,

          // Pretty print in development, JSON in production
          transport: config.isDevelopment
            ? {
                target: 'pino-pretty',
                options: {
                  colorize: true,
                  translateTime: 'HH:MM:ss.l',
                  ignore: 'pid,hostname',
                  singleLine: false,
                  messageFormat: '{context} - {msg}',
                },
              }
            : undefined,

          // Redact sensitive data from logs
          // These paths will be replaced with [Redacted] in logs
          redact: {
            paths: [
              // Request headers with sensitive data
              'req.headers.authorization',
              'req.headers.cookie',
              'req.headers["x-csrf-token"]',

              // Common sensitive fields (wildcards)
              '*.password',
              '*.token',
              '*.apiKey',
              '*.api_key',
              '*.secret',
              '*.accessToken',
              '*.refreshToken',
              '*.access_token',
              '*.refresh_token',
              '*.jwt',
              '*.jwtSecret',

              // Response headers
              'res.headers["set-cookie"]',

              // Body fields
              'req.body.password',
              'req.body.currentPassword',
              'req.body.newPassword',
              'req.body.confirmPassword',
            ],
            remove: true, // Completely remove redacted values instead of showing [Redacted]
          },

          // Add custom properties to each log entry
          customProps: (req: Request, _res: Response) => {
            const user = (req as any).user;
            return {
              context: 'HTTP',
              // Include user ID if authenticated
              ...(user?.id && { userId: user.id }),
              // Include correlation/request ID for distributed tracing
              correlationId:
                req.headers['x-correlation-id'] || req.headers['x-request-id'] || (req as any).id,
              // Include environment for filtering
              environment: config.nodeEnv,
            };
          },

          // Customize log messages
          customLogLevel: (_req: Request, res: Response, err: Error | undefined) => {
            // Log 4xx as warnings, 5xx as errors
            if (res.statusCode >= 500 || err) {
              return 'error';
            }
            if (res.statusCode >= 400) {
              return 'warn';
            }
            return 'info';
          },

          // Customize success message format
          customSuccessMessage: (req: Request, res: Response, _responseTime: number) => {
            return `${req.method} ${req.url} ${res.statusCode}`;
          },

          // Customize error message format
          customErrorMessage: (req: Request, _res: Response, err: Error) => {
            return `${req.method} ${req.url} - ${err.message}`;
          },

          // Automatically log all requests except excluded paths
          autoLogging: {
            ignore: (req: Request) => {
              const url = req.url || '';
              // Don't log health check requests (reduces noise)
              if (url.includes('/health') || url.includes('/ready') || url.includes('/live')) {
                return true;
              }
              // Don't log Swagger/OpenAPI requests in production
              if (config.isProduction && (url.includes('/docs') || url.includes('/swagger'))) {
                return true;
              }
              // Don't log favicon requests
              if (url.includes('/favicon.ico')) {
                return true;
              }
              return false;
            },
          },

          // Customize request serialization (what gets logged from request)
          serializers: {
            req: (req) => ({
              id: req.id,
              method: req.method,
              url: req.url,
              query: req.query,
              // Only log specific headers, not all
              headers: {
                'user-agent': req.headers['user-agent'],
                'content-type': req.headers['content-type'],
                'x-request-id': req.headers['x-request-id'],
                'x-correlation-id': req.headers['x-correlation-id'],
              },
              remoteAddress: req.remoteAddress,
            }),
            res: (res) => ({
              statusCode: res.statusCode,
            }),
          },
        },
      }),
    }),
  ],
})
export class LoggerModule {}
