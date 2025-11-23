import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import helmet from 'helmet';
import { AppModule } from '../src/app.module';
import { ConfigService } from '../src/config/config.service';

describe('Content Security Policy Headers (e2e)', () => {
  let app: INestApplication;
  let configService: ConfigService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configService = app.get(ConfigService);

    // Apply same security configuration as main.ts
    app.use(
      helmet({
        contentSecurityPolicy: {
          useDefaults: false,
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: configService.isDevelopment
              ? ["'self'", "'unsafe-inline'", "'unsafe-eval'"]
              : ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'"],
            fontSrc: ["'self'", 'data:'],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
            frameAncestors: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            upgradeInsecureRequests: configService.isProduction ? [] : null,
            reportUri: ['/api/v1/csp-violations'],
          },
          reportOnly: configService.cspReportOnly,
        },
        hsts: {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true,
        },
        frameguard: {
          action: 'deny',
        },
        noSniff: true,
        referrerPolicy: {
          policy: 'strict-origin-when-cross-origin',
        },
      }),
    );

    app.enableCors({
      origin: configService.corsOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
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

  describe('Content-Security-Policy Headers', () => {
    it('should include Content-Security-Policy header', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/auth/me');

      // Check for CSP header (either enforcing or report-only)
      const cspHeader = response.headers['content-security-policy'];
      const cspReportOnlyHeader = response.headers['content-security-policy-report-only'];

      expect(cspHeader || cspReportOnlyHeader).toBeDefined();
    });

    it('should have strict default-src directive', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/auth/me');

      const cspHeader = response.headers['content-security-policy'] || response.headers['content-security-policy-report-only'];
      
      expect(cspHeader).toContain("default-src 'self'");
    });

    it('should disallow object-src (plugins)', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/auth/me');

      const cspHeader = response.headers['content-security-policy'] || response.headers['content-security-policy-report-only'];
      
      expect(cspHeader).toContain("object-src 'none'");
    });

    it('should disallow frame-ancestors (clickjacking protection)', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/auth/me');

      const cspHeader = response.headers['content-security-policy'] || response.headers['content-security-policy-report-only'];
      
      expect(cspHeader).toContain("frame-ancestors 'none'");
    });

    it('should configure reportUri directive', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/auth/me');

      const cspHeader = response.headers['content-security-policy'] || response.headers['content-security-policy-report-only'];
      
      expect(cspHeader).toContain('report-uri /api/v1/csp-violations');
    });

    it('should allow unsafe-inline and unsafe-eval in development for Swagger', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/auth/me');

      const cspHeader = response.headers['content-security-policy'] || response.headers['content-security-policy-report-only'];
      
      if (configService.isDevelopment) {
        expect(cspHeader).toContain("'unsafe-inline'");
        expect(cspHeader).toContain("'unsafe-eval'");
      } else {
        // In production, these should not be present in script-src
        const scriptSrcMatch = cspHeader.match(/script-src[^;]+/);
        if (scriptSrcMatch) {
          expect(scriptSrcMatch[0]).not.toContain("'unsafe-eval'");
        }
      }
    });

    it('should restrict img-src appropriately', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/auth/me');

      const cspHeader = response.headers['content-security-policy'] || response.headers['content-security-policy-report-only'];
      
      expect(cspHeader).toContain("img-src 'self' data: https:");
    });

    it('should restrict form-action to self', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/auth/me');

      const cspHeader = response.headers['content-security-policy'] || response.headers['content-security-policy-report-only'];
      
      expect(cspHeader).toContain("form-action 'self'");
    });

    it('should restrict base-uri to self', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/auth/me');

      const cspHeader = response.headers['content-security-policy'] || response.headers['content-security-policy-report-only'];
      
      expect(cspHeader).toContain("base-uri 'self'");
    });
  });

  describe('Other Security Headers', () => {
    it('should include X-Frame-Options header', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/auth/me');

      expect(response.headers['x-frame-options']).toBe('DENY');
    });

    it('should include X-Content-Type-Options header', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/auth/me');

      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });

    it('should include Referrer-Policy header', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/auth/me');

      expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    });

    it('should include HSTS header in production', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/auth/me');

      if (configService.isProduction) {
        const hstsHeader = response.headers['strict-transport-security'];
        expect(hstsHeader).toBeDefined();
        expect(hstsHeader).toContain('max-age=31536000');
        expect(hstsHeader).toContain('includeSubDomains');
      }
    });
  });

  describe('CSP Violation Reporting Endpoint', () => {
    it('should accept CSP violation reports', async () => {
      const violationReport = {
        'csp-report': {
          'document-uri': 'https://example.com/page',
          referrer: '',
          'violated-directive': 'script-src',
          'effective-directive': 'script-src',
          'original-policy': "default-src 'self'",
          disposition: 'enforce',
          'blocked-uri': 'https://evil.com/script.js',
          'line-number': 10,
          'column-number': 5,
          'source-file': 'https://example.com/page',
          'status-code': 200,
          'script-sample': '',
        },
      };

      await request(app.getHttpServer())
        .post('/api/v1/csp-violations')
        .send(violationReport)
        .expect(204);
    });

    it('should be publicly accessible without authentication', async () => {
      const violationReport = {
        'csp-report': {
          'document-uri': 'https://example.com/page',
          referrer: '',
          'violated-directive': 'img-src',
          'effective-directive': 'img-src',
          'original-policy': "default-src 'self'",
          disposition: 'report',
          'blocked-uri': 'https://evil.com/image.png',
        },
      };

      // Should work without Authorization header
      const response = await request(app.getHttpServer())
        .post('/api/v1/csp-violations')
        .send(violationReport);

      expect(response.status).toBe(204);
    });
  });

  describe('CSP Report-Only Mode', () => {
    it('should use report-only header when CSP_REPORT_ONLY=true', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/auth/me');

      if (configService.cspReportOnly) {
        expect(response.headers['content-security-policy-report-only']).toBeDefined();
        expect(response.headers['content-security-policy']).toBeUndefined();
      } else {
        expect(response.headers['content-security-policy']).toBeDefined();
        expect(response.headers['content-security-policy-report-only']).toBeUndefined();
      }
    });
  });

  describe('Defense in Depth', () => {
    it('should have multiple layers of XSS protection', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/auth/me');

      // Layer 1: CSP
      expect(
        response.headers['content-security-policy'] ||
          response.headers['content-security-policy-report-only'],
      ).toBeDefined();

      // Layer 2: X-Content-Type-Options
      expect(response.headers['x-content-type-options']).toBe('nosniff');

      // Layer 3: X-Frame-Options
      expect(response.headers['x-frame-options']).toBe('DENY');

      // Note: Input sanitization (@Sanitize decorator) and output encoding
      // are tested separately in xss-sanitization.e2e-spec.ts
    });
  });
});
