import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import * as compression from 'compression';
import * as cookieParser from 'cookie-parser';
import { doubleCsrf } from 'csrf-csrf';
import { join } from 'path';
import { AppModule } from './app.module';
import { ConfigService } from './config/config.service';
import { TransformInterceptor } from './common/interceptors';

// Load .env file only in development (not needed in production/Docker)
if (process.env.NODE_ENV !== 'production') {
  // Note: dotenv is a devDependency, not available in production
  try {
    const { config } = require('dotenv');
    config({ path: join(__dirname, '../../../.env') });
  } catch (error) {
    // Silently ignore in production where dotenv is not installed
  }
}

async function bootstrap() {
  // Create NestJS application with buffered logs
  // This ensures logs are captured even during early bootstrap phase
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  // Use Pino logger as the global logger
  const logger = app.get(Logger);
  app.useLogger(logger);

  const configService = app.get(ConfigService);

  logger.log(`🚀 Starting Smart Apply API in ${configService.nodeEnv} mode`, 'Bootstrap');

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
    'Bootstrap',
  );

  // Compression middleware - reduces bandwidth usage for large JSON responses
  // Compresses responses with gzip for 80%+ bandwidth reduction (150KB → 30KB)
  // Only enabled if ENABLE_COMPRESSION=true (default: true)
  if (configService.enableCompression) {
    app.use(
      compression({
        filter: (req, res) => {
          // Don't compress if client explicitly disables it
          if (req.headers['x-no-compression']) {
            return false;
          }
          // Don't compress PDF download endpoints - PDFs are already compressed
          // and double-compression corrupts them. Check URL since Content-Type
          // isn't set yet when middleware runs.
          if (req.url?.includes('/download/')) {
            return false;
          }
          // Use default compression filter (checks Accept-Encoding header)
          return compression.filter(req, res);
        },
        threshold: 1024, // Only compress responses larger than 1KB (avoid overhead for small responses)
        level: 6, // Balance between compression speed and ratio (0-9, where 6 is good default)
      }),
    );
    logger.log(
      '🗜️  Response compression enabled (gzip, level 6, threshold: 1KB, excludes /download/)',
      'Bootstrap',
    );
  } else {
    logger.warn(
      '⚠️  Response compression disabled (set ENABLE_COMPRESSION=true to enable)',
      'Bootstrap',
    );
  }

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

    logger.log('🛡️  CSRF protection enabled', 'Bootstrap');
  } else {
    logger.warn('⚠️  CSRF protection disabled (set ENABLE_CSRF=true to enable)', 'Bootstrap');
  }

  // CORS configuration with restrictive policy
  // Only allows specified origins from CORS_ORIGINS environment variable
  // For production, set CORS_ORIGINS to your deployed frontend URLs
  // Example: CORS_ORIGINS=https://smartapply.azurewebsites.net,https://www.smartapply.com
  const corsOrigins = configService.corsOrigins;
  logger.log(`🌐 CORS enabled for origins: ${JSON.stringify(corsOrigins)}`, 'Bootstrap');

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'Cache-Control'], // Cache-Control needed for SSE
    exposedHeaders: [
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
      'Retry-After',
      'Content-Type', // Expose Content-Type for SSE (text/event-stream)
    ], // Expose rate limit headers to frontend
  });

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      // Allow extra properties in query params since some are extracted separately
      // e.g., includeJobPosting is extracted via @Query() decorator before PaginationQueryDto
      forbidNonWhitelisted: false,
      transform: true,
      disableErrorMessages: false,
      enableDebugMessages: true,
    }),
  );

  // Global response transformation - wraps all successful responses in { data, meta } format
  app.useGlobalInterceptors(new TransformInterceptor());

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

  // Swagger/OpenAPI Documentation
  // Available in both development and production for better API discoverability
  // Access at: http://localhost:3000/api/docs
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Smart Apply API')
    .setDescription(
      'AI-powered job application assistant API\n\n' +
        '## Features\n' +
        '- 🔐 JWT Authentication (HttpOnly cookies)\n' +
        '- 👤 User Profile Management\n' +
        '- 📝 Job Postings (Manual & Parser)\n' +
        '- 📄 Application Generation (LLM → PDF)\n' +
        '- 🎨 Custom Templates (Cover Letter & Resume)\n' +
        '- 📊 Real-time Status Updates (SSE)\n' +
        '- 🔒 Security Features (CSRF, Rate Limiting, XSS Protection)\n\n' +
        '## Authentication\n' +
        'This API uses JWT tokens stored in HttpOnly cookies for authentication. ' +
        'After logging in via `/auth/login`, the access token is automatically included in subsequent requests. ' +
        'Use the "Authorize" button to test endpoints in this UI.',
    )
    .setVersion('1.0')
    .setContact(
      'Smart Apply Team',
      'https://github.com/Ar1anit/smart-apply',
      'support@smartapply.com',
    )
    .setLicense('MIT', 'https://opensource.org/licenses/MIT')
    // JWT Bearer Authentication (for manual testing)
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token (without "Bearer " prefix)',
        in: 'header',
      },
      'JWT-auth', // This name must match @ApiBearerAuth() in controllers
    )
    // Cookie Authentication (primary authentication method)
    .addCookieAuth(
      'access_token',
      {
        type: 'apiKey',
        in: 'cookie',
        name: 'access_token',
        description: 'JWT access token stored in HttpOnly cookie (automatically sent after login)',
      },
      'cookie-auth',
    )
    // API Tags (organized by module)
    .addTag('auth', 'Authentication endpoints (register, login, logout, refresh)')
    .addTag('auth/sessions', 'Session management (list, revoke sessions)')
    .addTag('profile', 'User profile management (skills, experience, education)')
    .addTag('job-postings', 'Job postings management (manual creation & parser)')
    .addTag('applications', 'Application generation & management (LLM → PDF pipeline)')
    .addTag('templates', 'Template management (cover letter & resume templates)')
    .addTag('uploads', 'File uploads (PDF, DOCX)')
    .addTag('security', 'Security endpoints (CSP violation reporting)')
    // Server URLs
    .addServer('http://localhost:3000', 'Local Development')
    .addServer('https://api.smartapply.com', 'Production')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig, {
    operationIdFactory: (controllerKey: string, methodKey: string) => methodKey, // Use method name as operationId
  });

  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true, // Remember auth token in localStorage
      docExpansion: 'none', // Collapse all endpoints by default
      filter: true, // Enable search/filter
      showRequestDuration: true, // Show request duration in UI
      tryItOutEnabled: true, // Enable "Try it out" by default
      displayOperationId: false, // Hide operation IDs
      displayRequestDuration: true, // Show request duration
      tagsSorter: 'alpha', // Sort tags alphabetically
      operationsSorter: 'alpha', // Sort operations alphabetically
      defaultModelsExpandDepth: 2, // Expand models 2 levels deep
      defaultModelExpandDepth: 2, // Expand model schemas 2 levels deep
    },
    customSiteTitle: 'Smart Apply API Documentation',
    customfavIcon: 'https://nestjs.com/img/logo-small.svg',
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info { margin: 20px 0; }
      .swagger-ui .info .title { font-size: 36px; }
    `,
  });

  logger.log(
    `📚 Swagger documentation available at: http://localhost:${configService.port}/docs`,
    'Bootstrap',
  );

  const port = configService.port;
  await app.listen(port);

  logger.log(`🚀 Application running on: http://localhost:${port}/api/v1`, 'Bootstrap');
  logger.log(`📝 Environment: ${configService.nodeEnv}`, 'Bootstrap');
  logger.log(`💾 Storage driver: ${configService.storageDriver}`, 'Bootstrap');
  logger.log(`🤖 LLM provider: ${configService.llmProvider}`, 'Bootstrap');
  logger.log(`📊 Log level: ${configService.logLevel}`, 'Bootstrap');
}

bootstrap();
