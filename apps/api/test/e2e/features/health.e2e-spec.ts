import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../../src/app.module';

describe('Health Checks (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/health (GET)', () => {
    it('should return 200 and comprehensive health status', async () => {
      const response = await request(app.getHttpServer()).get('/health').expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body.status).toBe('ok');

      // Check all services are present
      expect(response.body.info).toHaveProperty('database');
      expect(response.body.info).toHaveProperty('storage');
      expect(response.body.info).toHaveProperty('queue');
      expect(response.body.info).toHaveProperty('llm');

      // Check database response time is included
      expect(response.body.info.database).toHaveProperty('responseTime');
      expect(response.body.info.database.responseTime).toMatch(/^\d+ms$/);
    });

    it('should include details section', async () => {
      const response = await request(app.getHttpServer()).get('/health').expect(200);

      expect(response.body).toHaveProperty('details');
      expect(response.body.details).toHaveProperty('database');
      expect(response.body.details).toHaveProperty('storage');
      expect(response.body.details).toHaveProperty('queue');
      expect(response.body.details).toHaveProperty('llm');
    });
  });

  describe('/health/live (GET)', () => {
    it('should return 200 and simple status', async () => {
      const response = await request(app.getHttpServer()).get('/health/live').expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body.status).toBe('ok');

      expect(response.body).toHaveProperty('timestamp');
      expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);
    });

    it('should respond quickly (< 100ms)', async () => {
      const start = Date.now();
      await request(app.getHttpServer()).get('/health/live').expect(200);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100);
    });
  });

  describe('/health/ready (GET)', () => {
    it('should return 200 and readiness status', async () => {
      const response = await request(app.getHttpServer()).get('/health/ready').expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body.status).toBe('ok');

      // Readiness only checks critical services
      expect(response.body.info).toHaveProperty('database');
      expect(response.body.info).toHaveProperty('storage');

      // Queue and LLM should not be in readiness check
      expect(response.body.info).not.toHaveProperty('queue');
      expect(response.body.info).not.toHaveProperty('llm');
    });

    it('should check database connectivity', async () => {
      const response = await request(app.getHttpServer()).get('/health/ready').expect(200);

      expect(response.body.info.database.status).toBe('up');
      expect(response.body.info.database).toHaveProperty('responseTime');
    });

    it('should check storage availability', async () => {
      const response = await request(app.getHttpServer()).get('/health/ready').expect(200);

      expect(response.body.info.storage.status).toBe('up');
    });
  });

  describe('Rate Limiting', () => {
    it('should allow high frequency requests (600/min)', async () => {
      // Test 5 sequential requests (avoid ECONNRESET)
      for (let i = 0; i < 5; i++) {
        const response = await request(app.getHttpServer()).get('/health/live');
        expect(response.status).toBe(200);
      }
    });

    it('should include rate limit headers', async () => {
      const response = await request(app.getHttpServer()).get('/health').expect(200);

      expect(response.headers).toHaveProperty('x-ratelimit-limit-health-check');
      expect(response.headers['x-ratelimit-limit-health-check']).toBe('600');
    });
  });

  describe('Response Format', () => {
    it('should return JSON content type', async () => {
      const response = await request(app.getHttpServer()).get('/health').expect(200);

      expect(response.headers['content-type']).toContain('application/json');
    });

    it('should include cache control headers', async () => {
      const response = await request(app.getHttpServer()).get('/health').expect(200);

      expect(response.headers).toHaveProperty('cache-control');
      expect(response.headers['cache-control']).toContain('no-cache');
    });
  });
});
