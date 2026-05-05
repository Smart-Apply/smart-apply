import { config } from 'dotenv';
config(); // Load .env before any imports

import request from 'supertest';
import cookieParser from 'cookie-parser';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../../src/app.module';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { TransformInterceptor } from '../../../src/common/interceptors';

describe('SubscriptionController (e2e)', () => {
  let app: INestApplication;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let prisma: PrismaService;

  let cookies: string[];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Login to get auth cookie
    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'demo@smartapply.com',
        password: 'Demo123!',
      })
      .expect(201);

    // Extract cookies from login response
    const setCookie = loginResponse.headers['set-cookie'];
    cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
  });

  afterAll(async () => {
    await app.close();
  });

  // ============================================
  // GET /subscription - Current Subscription
  // ============================================

  describe('GET /api/v1/subscription', () => {
    it('should return subscription info for authenticated user', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/subscription')
        .set('Cookie', cookies)
        .expect(200);

      expect(response.body.data).toHaveProperty('tier');
      expect(response.body.data).toHaveProperty('status');
      expect(response.body.data).toHaveProperty('applications');
      expect(response.body.data).toHaveProperty('interviewSessions');
      expect(response.body.data).toHaveProperty('periodStart');
      expect(response.body.data).toHaveProperty('periodEnd');
      expect(response.body.data).toHaveProperty('features');
    });

    it('should return 401 without auth token', async () => {
      await request(app.getHttpServer()).get('/api/v1/subscription').expect(401);
    });
  });

  // ============================================
  // GET /subscription/usage - Usage Statistics
  // ============================================

  describe('GET /api/v1/subscription/usage', () => {
    it('should return usage statistics for authenticated user', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/subscription/usage')
        .set('Cookie', cookies)
        .expect(200);

      expect(response.body.data).toHaveProperty('applications');
      expect(response.body.data.applications).toHaveProperty('used');
      expect(response.body.data.applications).toHaveProperty('limit');
      expect(response.body.data.applications).toHaveProperty('remaining');
      expect(response.body.data).toHaveProperty('interviewSessions');
      expect(response.body.data).toHaveProperty('periodStart');
      expect(response.body.data).toHaveProperty('periodEnd');
    });

    it('should return 401 without auth token', async () => {
      await request(app.getHttpServer()).get('/api/v1/subscription/usage').expect(401);
    });
  });

  // ============================================
  // GET /subscription/limits - Tier Limits
  // ============================================

  describe('GET /api/v1/subscription/limits', () => {
    it('should return limits for current tier', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/subscription/limits')
        .set('Cookie', cookies)
        .expect(200);

      expect(response.body.data).toHaveProperty('tier');
      expect(response.body.data).toHaveProperty('limits');
      expect(response.body.data.limits).toHaveProperty('applicationsPerMonth');
      expect(response.body.data.limits).toHaveProperty('interviewSessionsPerMonth');
      expect(response.body.data.limits).toHaveProperty('priority');
      expect(response.body.data.limits).toHaveProperty('features');
    });

    it('should return 401 without auth token', async () => {
      await request(app.getHttpServer()).get('/api/v1/subscription/limits').expect(401);
    });
  });

  // ============================================
  // GET /subscription/tiers - All Tiers (Public)
  // ============================================

  describe('GET /api/v1/subscription/tiers', () => {
    it('should return all tiers without authentication (public)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/subscription/tiers')
        .expect(200);

      expect(response.body.data).toHaveProperty('tiers');
      expect(Array.isArray(response.body.data.tiers)).toBe(true);
      expect(response.body.data.tiers).toHaveLength(3);

      // Verify tier structure
      const freeTier = response.body.data.tiers.find((t: any) => t.id === 'FREE');
      expect(freeTier).toBeDefined();
      expect(freeTier.name).toBe('Free');
      expect(freeTier.price).toBe(0);
      expect(freeTier).toHaveProperty('features');
      expect(freeTier).toHaveProperty('limits');

      const premiumTier = response.body.data.tiers.find((t: any) => t.id === 'PREMIUM');
      expect(premiumTier).toBeDefined();
      expect(premiumTier.name).toBe('Premium');
      expect(premiumTier.price).toBe(999);

      const premiumPlusTier = response.body.data.tiers.find((t: any) => t.id === 'PREMIUM_PLUS');
      expect(premiumPlusTier).toBeDefined();
      expect(premiumPlusTier.name).toBe('Premium+');
      expect(premiumPlusTier.price).toBe(2499);
    });
  });

  // ============================================
  // POST /subscription/check-action - Check Action
  // ============================================

  describe('POST /api/v1/subscription/check-action', () => {
    it('should check if application action is allowed', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/subscription/check-action')
        .set('Cookie', cookies)
        .send({ action: 'application' })
        .expect(201);

      expect(response.body.data).toHaveProperty('allowed');
      expect(response.body.data).toHaveProperty('remaining');
      expect(response.body.data).toHaveProperty('limit');
      expect(typeof response.body.data.allowed).toBe('boolean');
      expect(typeof response.body.data.remaining).toBe('number');
    });

    it('should check if interview action is allowed', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/subscription/check-action')
        .set('Cookie', cookies)
        .send({ action: 'interview' })
        .expect(201);

      expect(response.body.data).toHaveProperty('allowed');
      expect(response.body.data).toHaveProperty('remaining');
      expect(response.body.data).toHaveProperty('limit');
    });

    it('should reject invalid action', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/subscription/check-action')
        .set('Cookie', cookies)
        .send({ action: 'invalid-action' })
        .expect(400);

      // Message can be either a string or an array
      const message = Array.isArray(response.body.message)
        ? response.body.message[0]
        : response.body.message;
      expect(message).toContain('action must be either');
    });

    it('should reject missing action', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/subscription/check-action')
        .set('Cookie', cookies)
        .send({})
        .expect(400);
    });

    it('should return 401 without auth token', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/subscription/check-action')
        .send({ action: 'application' })
        .expect(401);
    });
  });

  // ============================================
  // GET /subscription/can-perform/:action - Legacy Endpoint
  // ============================================

  describe('GET /api/v1/subscription/can-perform/:action', () => {
    it('should check application action via GET (legacy)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/subscription/can-perform/application')
        .set('Cookie', cookies)
        .expect(200);

      expect(response.body.data).toHaveProperty('allowed');
      expect(response.body.data).toHaveProperty('remaining');
      expect(response.body.data).toHaveProperty('limit');
    });

    it('should check interview action via GET (legacy)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/subscription/can-perform/interview')
        .set('Cookie', cookies)
        .expect(200);

      expect(response.body.data).toHaveProperty('allowed');
      expect(response.body.data).toHaveProperty('remaining');
      expect(response.body.data).toHaveProperty('limit');
    });

    it('should return 401 without auth token', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/subscription/can-perform/application')
        .expect(401);
    });
  });

  // ============================================
  // GET /subscription/status - Legacy Endpoint
  // ============================================

  describe('GET /api/v1/subscription/status', () => {
    it('should return subscription status (alias)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/subscription/status')
        .set('Cookie', cookies)
        .expect(200);

      expect(response.body.data).toHaveProperty('tier');
      expect(response.body.data).toHaveProperty('status');
      expect(response.body.data).toHaveProperty('applications');
      expect(response.body.data).toHaveProperty('interviewSessions');
    });

    it('should return 401 without auth token', async () => {
      await request(app.getHttpServer()).get('/api/v1/subscription/status').expect(401);
    });
  });
});
