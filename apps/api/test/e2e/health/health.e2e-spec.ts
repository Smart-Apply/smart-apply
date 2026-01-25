import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../../../src/app.module';

describe('HealthController (e2e)', () => {
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

  describe('/api/v1/health (GET)', () => {
    it('should return health status (200, 503, or 500 depending on dependencies)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect((res) => {
          // Should return 200 (all healthy), 503 (some dependencies down), or 500 (error)
          expect([200, 500, 503]).toContain(res.status);
        });

      // For successful health checks, should have standard Terminus format
      if (response.status === 200 || response.status === 503) {
        expect(response.body).toHaveProperty('status');
        expect(response.body).toHaveProperty('info');
        expect(response.body).toHaveProperty('error');
        expect(response.body).toHaveProperty('details');
      }
    });

    it('should check all services in comprehensive health check', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect((res) => {
          expect([200, 500, 503]).toContain(res.status);
        });

      // Only verify service checks for successful Terminus responses
      if (response.status === 200 || response.status === 503) {
        // Verify services are checked (in either info or error)
        const allServices = { ...response.body.info, ...response.body.error };
        expect(Object.keys(allServices)).toEqual(
          expect.arrayContaining(['database', 'storage', 'queue', 'llm']),
        );
      }
    });

    it('should be accessible without authentication', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect((res) => {
          // Should not return 401 Unauthorized (health endpoints are public)
          expect(res.status).not.toBe(401);
          // Valid statuses: 200 (healthy), 503 (unhealthy), 500 (error during check)
          expect([200, 500, 503]).toContain(res.status);
        });

      // Should return some response body (health data or error)
      expect(response.body).toBeDefined();
    });

    it('should not be rate limited excessively', async () => {
      // Make multiple rapid requests to verify health endpoints aren't heavily rate limited
      // Use sequential requests to avoid connection issues
      const results: number[] = [];
      for (let i = 0; i < 5; i++) {
        const res = await request(app.getHttpServer()).get('/api/v1/health');
        results.push(res.status);
      }

      // None of the requests should be rate limited (429)
      results.forEach((status) => {
        expect(status).not.toBe(429);
        // Valid statuses: 200 (healthy), 500 (internal error), 503 (unhealthy)
        expect([200, 500, 503]).toContain(status);
      });
    });
  });

  describe('/api/v1/health/live (GET)', () => {
    it('should return 200 indicating app is alive', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/health/live').expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
    });

    it('should be a fast response (< 500ms)', async () => {
      const start = Date.now();

      await request(app.getHttpServer()).get('/api/v1/health/live').expect(200);

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(500);
    });

    it('should be accessible without authentication', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health/live')
        .expect((res) => {
          expect(res.status).not.toBe(401);
        });

      expect(response.body).toHaveProperty('status');
    });
  });

  describe('/api/v1/health/ready (GET)', () => {
    it('should return 200 when app is ready to serve traffic', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/health/ready').expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('info');
      expect(response.body).toHaveProperty('details');
    });

    it('should verify database connectivity', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/health/ready').expect(200);

      // Should check database health
      expect(response.body.info).toHaveProperty('database');
      expect(response.body.info.database).toHaveProperty('status', 'up');
    });

    it('should verify storage connectivity', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/health/ready').expect(200);

      // Should check storage health
      expect(response.body.info).toHaveProperty('storage');
      expect(response.body.info.storage).toHaveProperty('status', 'up');
    });

    it('should be accessible without authentication', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health/ready')
        .expect((res) => {
          expect(res.status).not.toBe(401);
        });

      expect(response.body).toHaveProperty('status');
    });
  });

  describe('/api/v1/health/details (GET)', () => {
    it('should return detailed health information with response times', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/health/details').expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('totalResponseTime');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('details');
    });

    it('should include response times for each service', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/health/details').expect(200);

      const { details } = response.body;

      // Verify all services have status and response time
      ['database', 'storage', 'queue', 'templates', 'llm'].forEach((service) => {
        expect(details).toHaveProperty(service);
        expect(details[service]).toHaveProperty('status');
        expect(details[service]).toHaveProperty('responseTime');
        expect(details[service].responseTime).toMatch(/^\d+ms$/);
      });
    });

    it('should return ISO 8601 timestamp', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/health/details').expect(200);

      const timestamp = new Date(response.body.timestamp);
      expect(timestamp).toBeInstanceOf(Date);
      expect(timestamp.getTime()).not.toBeNaN();
    });

    it('should include totalResponseTime', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/health/details').expect(200);

      expect(response.body.totalResponseTime).toMatch(/^\d+ms$/);
    });

    it('should be accessible without authentication', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health/details')
        .expect((res) => {
          expect(res.status).not.toBe(401);
        });

      expect(response.body).toHaveProperty('status');
    });
  });

  describe('Health Check Response Format', () => {
    it('should return consistent response format across liveness and readiness endpoints', async () => {
      const [liveRes, readyRes] = await Promise.all([
        request(app.getHttpServer()).get('/api/v1/health/live'),
        request(app.getHttpServer()).get('/api/v1/health/ready'),
      ]);

      // Liveness and readiness should have status field (these are critical endpoints)
      expect(liveRes.body).toHaveProperty('status');
      expect(readyRes.body).toHaveProperty('status');

      // Both should return 'ok' when core services are healthy
      expect(liveRes.body.status).toBe('ok');
      expect(readyRes.body.status).toBe('ok');
    });

    it('should return proper HTTP status codes for liveness and readiness', async () => {
      // Liveness should always return 200 when app is running
      await request(app.getHttpServer()).get('/api/v1/health/live').expect(200);

      // Readiness should return 200 when DB and storage are healthy
      await request(app.getHttpServer()).get('/api/v1/health/ready').expect(200);
    });
  });
});
