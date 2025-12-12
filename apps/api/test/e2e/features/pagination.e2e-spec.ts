import { config } from 'dotenv';
config(); // Load .env before any imports

import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../../src/app.module';
import { PrismaService } from '../../../src/prisma/prisma.service';

describe('Pagination (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    // Wait for module initialization
    await new Promise((resolve) => setTimeout(resolve, 500));

    prisma = app.get<PrismaService>(PrismaService);

    // Login to get auth token
    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'demo@smartapply.com',
        password: 'Demo123!',
      })
      .expect(201);

    authToken = loginResponse.body.accessToken;
    userId = loginResponse.body.user.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/applications (pagination)', () => {
    let applicationIds: string[] = [];
    let jobPostingId: string;

    beforeAll(async () => {
      // Create a job posting for testing
      const jobPosting = await prisma.jobPosting.create({
        data: {
          userId,
          title: 'Test Pagination Job',
          company: 'Test Company',
          fullText: 'Test job description for pagination tests',
        },
      });
      jobPostingId = jobPosting.id;

      // Create 25 applications for pagination testing
      const applications = await Promise.all(
        Array.from({ length: 25 }, (_, i) =>
          prisma.application.create({
            data: {
              userId,
              jobPostingId,
              title: `Test Application ${i + 1}`,
              status: 'PENDING',
            },
          }),
        ),
      );
      applicationIds = applications.map((app) => app.id);
    });

    afterAll(async () => {
      // Clean up test applications
      await prisma.application.deleteMany({
        where: { id: { in: applicationIds } },
      });
      await prisma.jobPosting.delete({
        where: { id: jobPostingId },
      });
    });

    it('should return first page with default limit (20)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/applications')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('items');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.items).toHaveLength(20);
      expect(response.body.pagination).toMatchObject({
        page: 1,
        limit: 20,
        total: expect.any(Number),
        totalPages: expect.any(Number),
      });
      expect(response.body.pagination.total).toBeGreaterThanOrEqual(25);
    });

    it('should return second page with default limit', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/applications?page=2')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.items).toBeDefined();
      expect(response.body.pagination).toMatchObject({
        page: 2,
        limit: 20,
        total: expect.any(Number),
        totalPages: expect.any(Number),
      });
    });

    it('should return custom page with custom limit', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/applications?page=1&limit=10')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.items).toHaveLength(10);
      expect(response.body.pagination).toMatchObject({
        page: 1,
        limit: 10,
        total: expect.any(Number),
        totalPages: expect.any(Number),
      });
    });

    it('should calculate total pages correctly', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/applications?limit=10')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const { total, totalPages, limit } = response.body.pagination;
      expect(totalPages).toBe(Math.ceil(total / limit));
    });

    it('should enforce max limit of 100', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/applications?limit=100')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.pagination.limit).toBe(100);
    });

    it('should reject limit greater than 100', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/applications?limit=101')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('should reject invalid page number (0)', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/applications?page=0')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('should reject invalid page number (negative)', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/applications?page=-1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('should return empty items for page beyond total pages', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/applications?page=999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.items).toHaveLength(0);
      expect(response.body.pagination.page).toBe(999);
    });
  });

  describe('GET /api/v1/job-postings (pagination)', () => {
    let jobPostingIds: string[] = [];

    beforeAll(async () => {
      // Create 30 job postings for pagination testing
      const jobPostings = await Promise.all(
        Array.from({ length: 30 }, (_, i) =>
          prisma.jobPosting.create({
            data: {
              userId,
              title: `Test Job Posting ${i + 1}`,
              company: `Company ${i + 1}`,
              fullText: `Job description ${i + 1}`,
            },
          }),
        ),
      );
      jobPostingIds = jobPostings.map((jp) => jp.id);
    });

    afterAll(async () => {
      // Clean up test job postings
      await prisma.jobPosting.deleteMany({
        where: { id: { in: jobPostingIds } },
      });
    });

    it('should return first page with default limit (20)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/job-postings')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('items');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.items).toHaveLength(20);
      expect(response.body.pagination.total).toBeGreaterThanOrEqual(30);
    });

    it('should return second page', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/job-postings?page=2&limit=15')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.items).toHaveLength(15);
      expect(response.body.pagination).toMatchObject({
        page: 2,
        limit: 15,
      });
    });

    it('should respect custom limit', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/job-postings?limit=5')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.items).toHaveLength(5);
      expect(response.body.pagination.limit).toBe(5);
    });
  });

  describe('GET /api/v1/auth/sessions (pagination)', () => {
    it('should return sessions with pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/auth/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('items');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination).toMatchObject({
        page: 1,
        limit: 20,
        total: expect.any(Number),
        totalPages: expect.any(Number),
      });
    });

    it('should respect custom pagination params', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/auth/sessions?page=1&limit=5')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.pagination).toMatchObject({
        page: 1,
        limit: 5,
      });
    });
  });
});
