import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import * as cookieParser from 'cookie-parser';
import { doubleCsrf } from 'csrf-csrf';
import { config } from 'dotenv';
import { AppModule } from './app.module';
import { ConfigService } from './config/config.service';

// Load .env file explicitly before bootstrap
config();

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  const configService = app.get(ConfigService);

  // Security
  app.use(helmet());

  // Cookie parser - must be before routes
  app.use(cookieParser());

  // CSRF Protection using Double Submit Cookie Pattern (Optional)
  // Enable with ENABLE_CSRF=true environment variable
  // This protects against CSRF attacks on state-changing operations
  let doubleCsrfProtection;
  if (configService.enableCsrf) {
    const {
      generateCsrfToken, // Generates a CSRF token pair (cookie + token)
      doubleCsrfProtection: csrfMiddleware, // Middleware to validate CSRF tokens
    } = doubleCsrf({
      getSecret: () => configService.jwtSecret, // Use JWT secret for CSRF token generation
      getSessionIdentifier: (req) => req.headers['authorization'] || '', // Use auth header as session identifier
      // Use __Host- prefix only in production (requires HTTPS)
      // In development, use simple name (localhost doesn't support __Host- prefix)
      cookieName: configService.isProduction ? '__Host-csrf' : 'csrf',
      cookieOptions: {
        httpOnly: true,
        // Use 'strict' in production for better security (assumes same-origin deployment)
        // Use 'lax' in development for cross-origin (frontend:3001 -> backend:3000)
        sameSite: configService.isProduction ? 'strict' : 'lax',
        secure: configService.isProduction, // HTTPS only in production
        path: '/',
      },
      size: 64, // Token size in bytes
      ignoredMethods: ['GET', 'HEAD', 'OPTIONS'], // Don't require CSRF for read-only operations
      getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token'] as string, // Read token from custom header
      errorConfig: {
        statusCode: 403, // Forbidden
        message: 'Invalid or missing CSRF token',
        code: 'EBADCSRFTOKEN',
      },
    });

    doubleCsrfProtection = csrfMiddleware;

    // Store CSRF utilities in app instance for controllers to access
    app.set('csrfGenerateToken', generateCsrfToken);
    app.set('csrfProtection', doubleCsrfProtection);

    logger.log('🛡️  CSRF protection enabled');
  } else {
    logger.warn('⚠️  CSRF protection disabled (set ENABLE_CSRF=true to enable)');
  }

  // CORS configuration with restrictive policy
  // Only allows specified origins from CORS_ORIGINS environment variable
  // For production, set CORS_ORIGINS to your deployed frontend URLs
  // Example: CORS_ORIGINS=https://smartapply.azurewebsites.net,https://www.smartapply.com
  app.enableCors({
    origin: configService.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'], // Allow CSRF header
  });

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      disableErrorMessages: false,
      enableDebugMessages: true,
    }),
  );

  // API prefix
  app.setGlobalPrefix('api/v1');

  // Apply CSRF protection globally if enabled (after API prefix)
  // This will validate CSRF tokens on all POST, PUT, DELETE, PATCH requests
  // Exception: /auth/refresh is excluded because it's already protected by HttpOnly cookie
  if (configService.enableCsrf && doubleCsrfProtection) {
    app.use((req, res, next) => {
      // Skip CSRF validation for /auth/refresh endpoint
      // The refresh endpoint is already protected by the HttpOnly refresh_token cookie
      // Adding CSRF here would create a chicken-and-egg problem:
      // - User needs valid access token to get CSRF token
      // - But refresh endpoint is called when access token is expired
      if (req.path === '/api/v1/auth/refresh') {
        return next();
      }
      // Apply CSRF protection to all other routes
      doubleCsrfProtection(req, res, next);
    });
  }

  // Swagger documentation
  if (configService.isDevelopment) {
    const config = new DocumentBuilder()
      .setTitle('Smart Apply API')
      .setDescription('AI-powered job application assistant')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
    logger.log('📚 Swagger documentation available at /docs');
  }

  const port = configService.port;
  await app.listen(port);

  logger.log(`🚀 Application running on: http://localhost:${port}/api/v1`);
  logger.log(`📝 Environment: ${configService.nodeEnv}`);
  logger.log(`💾 Storage driver: ${configService.storageDriver}`);
  logger.log(`🤖 LLM provider: ${configService.llmProvider}`);
}

bootstrap();
