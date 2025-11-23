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

  // Enhanced Helmet configuration with strict Content Security Policy (CSP)
  // CSP provides defense-in-depth protection against XSS attacks by controlling
  // which resources the browser is allowed to load and execute
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false, // We define explicit directives for clarity
        directives: {
          defaultSrc: ["'self'"], // Only allow resources from same origin by default
          scriptSrc: configService.isDevelopment
            ? ["'self'", "'unsafe-inline'", "'unsafe-eval'"] // Development: Swagger UI needs unsafe-inline/eval
            : ["'self'"], // Production: No inline scripts allowed
          styleSrc: ["'self'", "'unsafe-inline'"], // Inline styles needed for Swagger UI
          imgSrc: ["'self'", 'data:', 'https:'], // Allow images from self, data URIs, and HTTPS
          connectSrc: ["'self'"], // API calls only to same origin
          fontSrc: ["'self'", 'data:'], // Fonts from self and data URIs
          objectSrc: ["'none'"], // Disallow plugins (Flash, Java, etc.)
          mediaSrc: ["'self'"], // Media from same origin only
          frameSrc: ["'none'"], // No iframes allowed
          frameAncestors: ["'none'"], // Prevent embedding in iframes (clickjacking protection)
          baseUri: ["'self'"], // Restrict base tag to prevent injection
          formAction: ["'self'"], // Forms can only submit to same origin
          // upgradeInsecureRequests: Helmet-specific behavior
          // Empty array [] enables the directive (production: force HTTPS)
          // null disables the directive (development: allow HTTP)
          upgradeInsecureRequests: configService.isProduction ? [] : null,
          reportUri: ['/api/v1/csp-violations'], // Report violations to our endpoint
        },
        reportOnly: configService.cspReportOnly, // Start with report-only mode for testing
      },
      hsts: {
        maxAge: 31536000, // 1 year in seconds
        includeSubDomains: true,
        preload: true, // Enable HSTS preloading
      },
      frameguard: {
        action: 'deny', // Deny all framing attempts
      },
      noSniff: true, // Prevent MIME type sniffing
      referrerPolicy: {
        policy: 'strict-origin-when-cross-origin', // Privacy-preserving referrer policy
      },
    }),
  );

  logger.log(
    `🛡️  CSP configured in ${configService.cspReportOnly ? 'report-only' : 'enforcing'} mode`,
  );

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
