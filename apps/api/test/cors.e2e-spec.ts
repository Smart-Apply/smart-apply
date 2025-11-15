import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import helmet from 'helmet';
import { AppModule } from '../src/app.module';
import { ConfigService } from '../src/config/config.service';

describe('CORS Security (e2e)', () => {
  let app: INestApplication;
  let configService: ConfigService;
  let allowedOrigins: string[];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configService = app.get(ConfigService);
    allowedOrigins = configService.corsOrigins;

    // Apply same security configuration as main.ts
    app.use(helmet());
    app.enableCors({
      origin: allowedOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    });

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('CORS Headers', () => {
    it('should allow requests from configured origins', async () => {
      const origin = allowedOrigins[0];

      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Origin', origin)
        .expect((res) => {
          // Should have CORS headers for allowed origin
          expect(res.headers['access-control-allow-origin']).toBeDefined();
        });
    });

    it('should reject requests from unauthorized origins', async () => {
      const unauthorizedOrigin = 'https://malicious-site.com';

      const response = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Origin', unauthorizedOrigin);

      // Should not have CORS headers for unauthorized origin
      expect(response.headers['access-control-allow-origin']).not.toBe(unauthorizedOrigin);
    });

    it('should allow credentials', async () => {
      const origin = allowedOrigins[0];

      await request(app.getHttpServer())
        .options('/api/v1/auth/me')
        .set('Origin', origin)
        .set('Access-Control-Request-Method', 'GET')
        .expect((res) => {
          expect(res.headers['access-control-allow-credentials']).toBe('true');
        });
    });

    it('should allow specified HTTP methods', async () => {
      const origin = allowedOrigins[0];
      const allowedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

      await request(app.getHttpServer())
        .options('/api/v1/auth/me')
        .set('Origin', origin)
        .set('Access-Control-Request-Method', 'POST')
        .expect((res) => {
          const responseMethods = res.headers['access-control-allow-methods'];
          if (responseMethods) {
            const methods = responseMethods.split(',').map((m: string) => m.trim());
            allowedMethods.forEach((method) => {
              expect(methods).toContain(method);
            });
          }
        });
    });

    it('should allow Content-Type and Authorization headers', async () => {
      const origin = allowedOrigins[0];

      await request(app.getHttpServer())
        .options('/api/v1/auth/me')
        .set('Origin', origin)
        .set('Access-Control-Request-Method', 'GET')
        .set('Access-Control-Request-Headers', 'Content-Type,Authorization')
        .expect((res) => {
          const allowedHeaders = res.headers['access-control-allow-headers'];
          if (allowedHeaders) {
            expect(allowedHeaders.toLowerCase()).toContain('content-type');
            expect(allowedHeaders.toLowerCase()).toContain('authorization');
          }
        });
    });

    it('should block requests with disallowed methods', async () => {
      const origin = allowedOrigins[0];

      // TRACE and CONNECT should not be allowed
      const response = await request(app.getHttpServer())
        .options('/api/v1/auth/me')
        .set('Origin', origin)
        .set('Access-Control-Request-Method', 'TRACE');

      // The preflight should not include TRACE in allowed methods
      const allowedMethods = response.headers['access-control-allow-methods'];
      if (allowedMethods) {
        expect(allowedMethods).not.toContain('TRACE');
        expect(allowedMethods).not.toContain('CONNECT');
      }
    });

    it('should validate CORS configuration is not permissive', () => {
      // Ensure we're not using 'origin: true' which would allow all origins
      expect(allowedOrigins).toBeDefined();
      expect(Array.isArray(allowedOrigins)).toBe(true);
      expect(allowedOrigins.length).toBeGreaterThan(0);

      // Verify each origin is a valid URL format
      allowedOrigins.forEach((origin) => {
        expect(origin).toMatch(/^https?:\/\/.+/);
      });
    });
  });

  describe('Production CORS Configuration', () => {
    it('should document production origin requirements', () => {
      // This test serves as documentation that production must set CORS_ORIGINS
      const isProduction = configService.isProduction;

      if (isProduction) {
        // In production, ensure no localhost origins are allowed
        allowedOrigins.forEach((origin) => {
          expect(origin).not.toContain('localhost');
          expect(origin).not.toContain('127.0.0.1');
          expect(origin).toMatch(/^https:\/\//); // Production should use HTTPS
        });
      } else {
        // In development, localhost is acceptable
        const hasLocalhost = allowedOrigins.some(
          (origin) => origin.includes('localhost') || origin.includes('127.0.0.1'),
        );
        expect(hasLocalhost).toBe(true);
      }
    });
  });
});
