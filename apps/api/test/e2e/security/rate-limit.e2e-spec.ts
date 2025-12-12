import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../../../src/app.module';

describe('Rate Limiting (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Add cookie parser middleware
    app.use(cookieParser());

    // Set global prefix to match production setup
    app.setGlobalPrefix('api/v1');

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

  describe('Auth Endpoint Rate Limiting', () => {
    it('should enforce strict rate limits on login endpoint (5 requests per 15 min)', async () => {
      const email = 'ratelimit-test@example.com';
      const password = 'WrongPassword123!';

      // Make 5 requests (should succeed or fail with 401, but not 429)
      for (let i = 0; i < 5; i++) {
        const response = await request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .send({ email, password });

        // Should not be rate limited yet
        expect(response.status).not.toBe(429);

        // Should have rate limit headers
        expect(response.headers['x-ratelimit-limit']).toBeDefined();
        expect(response.headers['x-ratelimit-remaining']).toBeDefined();
        expect(response.headers['x-ratelimit-reset']).toBeDefined();
      }

      // 6th request should be rate limited
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password });

      expect(response.status).toBe(429);
      expect(response.headers['retry-after']).toBeDefined();
    }, 30000); // Increase timeout for this test

    it('should enforce strict rate limits on register endpoint (5 requests per 15 min)', async () => {
      // Make 5 registration attempts
      for (let i = 0; i < 5; i++) {
        const response = await request(app.getHttpServer())
          .post('/api/v1/auth/register')
          .send({
            email: `ratelimit-register-${Date.now()}-${i}@example.com`,
            password: 'Test123!',
            fullName: 'Rate Limit Test',
          });

        // Should not be rate limited yet
        expect(response.status).not.toBe(429);

        // Should have rate limit headers
        expect(response.headers['x-ratelimit-limit']).toBeDefined();
        expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      }

      // 6th request should be rate limited
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: `ratelimit-register-final-${Date.now()}@example.com`,
          password: 'Test123!',
        });

      expect(response.status).toBe(429);
      expect(response.headers['retry-after']).toBeDefined();
    }, 30000);

    it('should include proper rate limit headers', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: `headers-test-${Date.now()}@example.com`,
          password: 'Test123!',
        });

      // Check for rate limit headers
      expect(response.headers['x-ratelimit-limit']).toBe('5');
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();

      const remaining = parseInt(response.headers['x-ratelimit-remaining']);
      expect(remaining).toBeGreaterThanOrEqual(0);
      expect(remaining).toBeLessThanOrEqual(5);

      // Verify X-RateLimit-Reset is a timestamp in the future
      const resetTimestamp = parseInt(response.headers['x-ratelimit-reset']);
      expect(resetTimestamp).toBeGreaterThan(Date.now());
    });

    it('should expose rate limit headers via CORS', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('Origin', 'http://localhost:3001')
        .send({
          email: `cors-test-${Date.now()}@example.com`,
          password: 'Test123!',
        });

      // Check that CORS Access-Control-Expose-Headers includes rate limit headers
      const exposedHeaders = response.headers['access-control-expose-headers'];
      expect(exposedHeaders).toBeDefined();
      expect(exposedHeaders).toContain('X-RateLimit-Limit');
      expect(exposedHeaders).toContain('X-RateLimit-Remaining');
      expect(exposedHeaders).toContain('X-RateLimit-Reset');
      expect(exposedHeaders).toContain('Retry-After');
    });
  });

  describe('Protected Endpoint Rate Limiting', () => {
    let cookies: string[];

    beforeAll(async () => {
      // Create a test user and get auth cookie
      const email = `protected-ratelimit-${Date.now()}@example.com`;
      const response = await request(app.getHttpServer()).post('/api/v1/auth/register').send({
        email,
        password: 'Test123!',
        fullName: 'Protected Rate Limit Test',
      });

      const setCookie = response.headers['set-cookie'];
      cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
    });

    it('should use default rate limit for authenticated endpoints (100 per 15 min)', async () => {
      // Make several requests to a protected endpoint
      for (let i = 0; i < 10; i++) {
        const response = await request(app.getHttpServer())
          .get('/api/v1/auth/me')
          .set('Cookie', cookies);

        expect(response.status).toBe(200);
        expect(response.headers['x-ratelimit-limit']).toBe('100');
      }
    });
  });

  describe('Rate Limit by IP', () => {
    it('should rate limit based on IP address for auth endpoints', async () => {
      const email = `ip-ratelimit-${Date.now()}@example.com`;

      // All requests from same IP should count towards the same limit
      const requests: Promise<any>[] = [];
      for (let i = 0; i < 6; i++) {
        requests.push(
          request(app.getHttpServer())
            .post('/api/v1/auth/login')
            .send({ email, password: 'Test123!' }),
        );
      }

      const responses = await Promise.all(requests);

      // Last response should be rate limited
      const rateLimitedResponses = responses.filter((r: any) => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    }, 30000);
  });
});
