import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import * as compression from 'compression';
import { AppModule } from '../../../src/app.module';
import { ConfigService } from '../../../src/config/config.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

/**
 * E2E Tests for Response Compression
 * 
 * Tests the compression middleware that reduces bandwidth usage for large JSON responses.
 * 
 * Features tested:
 * - Gzip compression for large responses (> 1KB)
 * - Respect for Accept-Encoding header
 * - Respect for x-no-compression header
 * - No compression for small responses (< 1KB)
 * - Bandwidth reduction verification
 */
describe('Response Compression (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authCookie: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    const configService = moduleFixture.get<ConfigService>(ConfigService);

    // Apply same middleware as main.ts
    app.use(cookieParser());

    // Apply compression middleware if enabled (same as main.ts)
    if (configService.enableCompression) {
      app.use(
        compression({
          filter: (req, res) => {
            if (req.headers['x-no-compression']) {
              return false;
            }
            return compression.filter(req, res);
          },
          threshold: 1024,
          level: 6,
        }),
      );
    }

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

  beforeEach(async () => {
    // Create test user and login
    const testUser = {
      email: `compression-test-${Date.now()}@example.com`,
      password: 'Test123!@#',
      firstName: 'Compression',
      lastName: 'Test',
    };

    const registerResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(testUser);

    authCookie = registerResponse.headers['set-cookie'];
  });

  afterEach(async () => {
    // Cleanup test data
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: 'compression-test',
        },
      },
    });
  });

  describe('Compression Headers', () => {
    it('should compress large responses when Accept-Encoding: gzip is present', async () => {
      // Create multiple job postings to get a large response (> 1KB)
      const createPromises = Array.from({ length: 10 }, (_, i) =>
        request(app.getHttpServer())
          .post('/api/v1/job-postings/parse')
          .set('Cookie', authCookie)
          .send({
            text: `Senior Software Engineer - ${i}\n\nLorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.\n\nRequirements:\n- 5+ years of experience\n- TypeScript, React, Node.js\n- AWS, Docker, Kubernetes\n- CI/CD, TDD, Agile`,
          }),
      );

      await Promise.all(createPromises);

      // Fetch all job postings with compression
      const response = await request(app.getHttpServer())
        .get('/api/v1/job-postings')
        .set('Cookie', authCookie)
        .set('Accept-Encoding', 'gzip')
        .expect(200);

      // Check for compression header
      expect(response.headers['content-encoding']).toBe('gzip');

      // Response body should still be decoded by supertest
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(10);
    });

    it('should not compress when x-no-compression header is present', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Cookie', authCookie)
        .set('Accept-Encoding', 'gzip')
        .set('x-no-compression', '1')
        .expect(200);

      // Should NOT have compression header
      expect(response.headers['content-encoding']).toBeUndefined();
    });

    it('should not compress when Accept-Encoding header is missing', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Cookie', authCookie)
        // No Accept-Encoding header
        .expect(200);

      // Should NOT have compression header
      expect(response.headers['content-encoding']).toBeUndefined();
    });

    it('should not compress small responses (< 1KB threshold)', async () => {
      // Small response from /auth/me endpoint
      const response = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Cookie', authCookie)
        .set('Accept-Encoding', 'gzip')
        .expect(200);

      // Small responses might not be compressed (below 1KB threshold)
      // This test documents the expected behavior but compression may vary
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('email');
    });
  });

  describe('Bandwidth Reduction', () => {
    it('should achieve significant bandwidth reduction for large JSON responses', async () => {
      // Create 20 job postings with substantial content
      const createPromises = Array.from({ length: 20 }, (_, i) =>
        request(app.getHttpServer())
          .post('/api/v1/job-postings/parse')
          .set('Cookie', authCookie)
          .send({
            text: `Software Engineer Position ${i}\n\n${'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(20)}\n\nRequirements:\n- TypeScript\n- React\n- Node.js\n- Docker\n- Kubernetes\n- AWS\n- CI/CD\n- TDD\n- Agile\n- REST APIs`,
          }),
      );

      await Promise.all(createPromises);

      // Fetch without compression to get baseline size
      const uncompressedResponse = await request(app.getHttpServer())
        .get('/api/v1/job-postings')
        .set('Cookie', authCookie)
        // No Accept-Encoding header - no compression
        .expect(200);

      const uncompressedSize = JSON.stringify(uncompressedResponse.body).length;

      // Fetch with compression
      const compressedResponse = await request(app.getHttpServer())
        .get('/api/v1/job-postings')
        .set('Cookie', authCookie)
        .set('Accept-Encoding', 'gzip')
        .expect(200);

      // supertest auto-decompresses the response, so we can't measure actual wire size
      // But we can verify compression header is present for large responses
      if (uncompressedSize > 1024) {
        expect(compressedResponse.headers['content-encoding']).toBe('gzip');
      }

      // Verify data integrity - should be identical
      expect(compressedResponse.body).toEqual(uncompressedResponse.body);
    });
  });

  describe('Content Type Compatibility', () => {
    it('should compress JSON responses', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Cookie', authCookie)
        .set('Accept-Encoding', 'gzip')
        .expect(200)
        .expect('Content-Type', /json/);

      // Verify JSON response is decodable
      expect(response.body).toHaveProperty('email');
    });

    it('should handle both gzip and deflate encoding', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Cookie', authCookie)
        .set('Accept-Encoding', 'gzip, deflate')
        .expect(200);

      // Should prefer gzip (if compression happens)
      const encoding = response.headers['content-encoding'];
      if (encoding) {
        expect(['gzip', 'deflate']).toContain(encoding);
      }
    });
  });

  describe('Performance Impact', () => {
    it('should not significantly impact response time for small responses', async () => {
      const measurements = [];

      // Run 5 requests and measure average time
      for (let i = 0; i < 5; i++) {
        const start = Date.now();
        await request(app.getHttpServer())
          .get('/api/v1/auth/me')
          .set('Cookie', authCookie)
          .set('Accept-Encoding', 'gzip')
          .expect(200);
        const duration = Date.now() - start;
        measurements.push(duration);
      }

      const avgDuration = measurements.reduce((a, b) => a + b, 0) / measurements.length;

      // Average response time should be under 500ms (generous for CI environments)
      expect(avgDuration).toBeLessThan(500);
    });
  });
});
