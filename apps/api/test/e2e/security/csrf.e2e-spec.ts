import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { doubleCsrf } from 'csrf-csrf';
import { AppModule } from '../../../src/app.module';
import { ConfigService } from '../../../src/config/config.service';

describe('CSRF Protection (e2e)', () => {
  let app: INestApplication;
  let csrfToken: string;
  let csrfCookie: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    const configService = app.get(ConfigService);

    // Apply middleware in the same order as main.ts
    app.use(helmet());
    app.use(cookieParser());

    // Configure CSRF protection
    const { generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
      getSecret: () => configService.jwtSecret,
      getSessionIdentifier: (req) => req.headers['authorization'] || '',
      cookieName: '__Host-csrf',
      cookieOptions: {
        httpOnly: true,
        sameSite: 'strict',
        secure: false, // Test environment doesn't use HTTPS
        path: '/',
      },
      size: 64,
      ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
      getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token'] as string,
    });

    // Store CSRF utilities in app's underlying Express instance
    const httpAdapter = app.getHttpAdapter();
    httpAdapter.getInstance().set('csrfGenerateToken', generateCsrfToken);
    httpAdapter.getInstance().set('csrfProtection', doubleCsrfProtection);

    // Set global prefix and pipes
    app.setGlobalPrefix('api/v1');

    // Apply CSRF protection globally
    app.use(doubleCsrfProtection);

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/auth/csrf-token', () => {
    it('should return CSRF token', () => {
      return request(app.getHttpServer())
        .get('/api/v1/auth/csrf-token')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('csrfToken');
          expect(res.body).toHaveProperty('message');
          expect(typeof res.body.csrfToken).toBe('string');
          expect(res.body.csrfToken.length).toBeGreaterThan(0);

          // Store for next tests
          csrfToken = res.body.csrfToken;

          // Extract CSRF cookie
          const cookies = res.headers['set-cookie'] as unknown as string[] | undefined;
          expect(cookies).toBeDefined();
          const csrfCookieHeader = cookies?.find((c: string) => c.includes('__Host-csrf'));
          expect(csrfCookieHeader).toBeDefined();
          csrfCookie = csrfCookieHeader!;
        });
    });
  });

  describe('POST requests without CSRF token', () => {
    it('should reject POST /api/v1/auth/register without CSRF token', async () => {
      const email = `test-csrf-${Date.now()}@example.com`;

      // Try to register without CSRF token
      return request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email,
          password: 'Test123!',
          firstName: 'Test',
          lastName: 'User',
        })
        .expect(403)
        .expect((res) => {
          // Should get CSRF error
          expect(res.body).toHaveProperty('message');
        });
    });
  });

  describe('POST requests with CSRF token', () => {
    beforeEach(async () => {
      // Fetch CSRF token before each test
      const res = await request(app.getHttpServer()).get('/api/v1/auth/csrf-token').expect(200);

      csrfToken = res.body.csrfToken;

      // Extract cookie
      const cookies = res.headers['set-cookie'] as unknown as string[] | undefined;
      const csrfCookieHeader = cookies?.find((c: string) => c.includes('__Host-csrf'));
      csrfCookie = csrfCookieHeader!;
    });

    it('should accept POST /api/v1/auth/register with valid CSRF token', async () => {
      const email = `test-csrf-valid-${Date.now()}@example.com`;

      return request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .set('Cookie', csrfCookie)
        .set('X-CSRF-Token', csrfToken)
        .send({
          email,
          password: 'Test123!',
          firstName: 'Test',
          lastName: 'User',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.user).toHaveProperty('email', email);
        });
    });

    it('should reject POST with mismatched CSRF token', async () => {
      const email = `test-csrf-mismatch-${Date.now()}@example.com`;

      return request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .set('Cookie', csrfCookie)
        .set('X-CSRF-Token', 'invalid-token-12345')
        .send({
          email,
          password: 'Test123!',
          firstName: 'Test',
          lastName: 'User',
        })
        .expect(403)
        .expect((res) => {
          expect(res.body).toHaveProperty('message');
        });
    });
  });

  describe('GET requests without CSRF token', () => {
    it('should allow GET /api/v1/auth/me without CSRF token', async () => {
      // First register and login to get auth cookie
      const email = `test-csrf-get-${Date.now()}@example.com`;

      // Get CSRF token for registration
      const csrfRes = await request(app.getHttpServer()).get('/api/v1/auth/csrf-token').expect(200);

      const token = csrfRes.body.csrfToken;
      const cookies = csrfRes.headers['set-cookie'] as unknown as string[] | undefined;
      const cookie = cookies?.find((c: string) => c.includes('__Host-csrf'))!;

      // Register with CSRF
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .set('Cookie', cookie)
        .set('X-CSRF-Token', token)
        .send({
          email,
          password: 'Test123!',
          firstName: 'Test',
          lastName: 'User',
        })
        .expect(201);

      // Login to get auth cookie
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('Cookie', cookie)
        .set('X-CSRF-Token', token)
        .send({
          email,
          password: 'Test123!',
        })
        .expect(200);

      // Extract auth cookie
      const authCookies = loginRes.headers['set-cookie'] as unknown as string[] | undefined;
      const authCookie = authCookies?.find((c: string) => c.includes('access_token'))!;

      // GET request should work without CSRF token (only auth cookie needed)
      return request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Cookie', authCookie)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('email', email);
        });
    });
  });

  describe('PUT/DELETE requests', () => {
    let authCookie: string;
    let testEmail: string;

    beforeEach(async () => {
      // Setup: Register and login to get auth cookie
      testEmail = `test-csrf-mutate-${Date.now()}@example.com`;

      // Get CSRF token
      const csrfRes = await request(app.getHttpServer()).get('/api/v1/auth/csrf-token').expect(200);

      const token = csrfRes.body.csrfToken;
      const cookies = csrfRes.headers['set-cookie'] as unknown as string[] | undefined;
      const cookie = cookies?.find((c: string) => c.includes('__Host-csrf'))!;

      // Register
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .set('Cookie', cookie)
        .set('X-CSRF-Token', token)
        .send({
          email: testEmail,
          password: 'Test123!',
          firstName: 'Test',
          lastName: 'User',
        })
        .expect(201);

      // Login
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('Cookie', cookie)
        .set('X-CSRF-Token', token)
        .send({
          email: testEmail,
          password: 'Test123!',
        })
        .expect(200);

      const authCookies = loginRes.headers['set-cookie'] as unknown as string[] | undefined;
      authCookie = authCookies?.find((c: string) => c.includes('access_token'))!;

      // Refresh CSRF token for mutations
      const newCsrfRes = await request(app.getHttpServer())
        .get('/api/v1/auth/csrf-token')
        .expect(200);

      csrfToken = newCsrfRes.body.csrfToken;
      const newCookies = newCsrfRes.headers['set-cookie'] as unknown as string[] | undefined;
      csrfCookie = newCookies?.find((c: string) => c.includes('__Host-csrf'))!;
    });

    it('should reject PUT /api/v1/profile without CSRF token', () => {
      return request(app.getHttpServer())
        .put('/api/v1/profile')
        .set('Cookie', authCookie)
        .send({
          name: 'Updated Name',
        })
        .expect(403);
    });

    it('should accept PUT /api/v1/profile with valid CSRF token', () => {
      return request(app.getHttpServer())
        .put('/api/v1/profile')
        .set('Cookie', [authCookie, csrfCookie].join('; '))
        .set('X-CSRF-Token', csrfToken)
        .send({
          name: 'Updated Name',
        })
        .expect(200);
    });
  });
});
