import { config } from 'dotenv';
config(); // Load .env before any imports

import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('ApplicationsController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let userId: string;
  let jobPostingId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    // Wait for module initialization (JobsService.onModuleInit)
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

    // Get or create a job posting
    const existingJobPosting = await prisma.jobPosting.findFirst({ where: { userId } });
    if (existingJobPosting) {
      jobPostingId = existingJobPosting.id;
    } else {
      const newJobPosting = await prisma.jobPosting.create({
        data: {
          userId,
          title: 'Software Engineer',
          company: 'Test Company',
          description: 'Test description for E2E tests',
          requirements: [],
          responsibilities: [],
          niceToHave: [],
        },
      });
      jobPostingId = newJobPosting.id;
    }
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.application.deleteMany({
      where: { userId },
    });
    await app.close();
  });

  describe('POST /api/v1/applications', () => {
    it('should create an application', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/applications')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          jobPostingId,
          notes: 'Test application from E2E',
        });

      if (response.status !== 201) {
        console.error('Error response:', response.body);
      }

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        id: expect.any(String),
        userId,
        jobPostingId,
        status: 'PENDING',
        notes: 'Test application from E2E',
      });
      expect(response.body.createdAt).toBeDefined();
      expect(response.body.updatedAt).toBeDefined();
    });

    it('should return 400 if job posting not found', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/applications')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          jobPostingId: '550e8400-e29b-41d4-a716-446655440000',
        })
        .expect(404);

      expect(response.body.message).toContain('not found');
    });

    it('should return 401 without auth token', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/applications')
        .send({
          jobPostingId,
        })
        .expect(401);
    });

    it('should return 404 with non-existent job posting ID', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/applications')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          jobPostingId: 'non-existent-id',
        })
        .expect(404);
    });
  });

  describe('GET /api/v1/applications', () => {
    it('should return all applications', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/applications')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('id');
      expect(response.body[0]).toHaveProperty('status');
      expect(response.body[0]).toHaveProperty('jobPostingId');
    });

    it('should include job posting details with query param', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/applications?includeJobPosting=true')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      if (response.body.length > 0) {
        expect(response.body[0].jobPosting).toBeDefined();
        expect(response.body[0].jobPosting.title).toBeDefined();
        expect(response.body[0].jobPosting.company).toBeDefined();
      }
    });

    it('should return 401 without auth token', async () => {
      await request(app.getHttpServer()).get('/api/v1/applications').expect(401);
    });
  });

  describe('GET /api/v1/applications/:id', () => {
    let applicationId: string;

    beforeAll(async () => {
      // Create an application for testing
      const application = await prisma.application.create({
        data: {
          userId,
          jobPostingId,
          status: 'PENDING',
          notes: 'Test for findOne',
        },
      });
      applicationId = application.id;
    });

    it('should return application by ID', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/applications/${applicationId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.id).toBe(applicationId);
      expect(response.body.userId).toBe(userId);
      expect(response.body.notes).toBe('Test for findOne');
    });

    it('should include job posting with query param', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/applications/${applicationId}?includeJobPosting=true`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.jobPosting).toBeDefined();
      expect(response.body.jobPosting.title).toBeDefined();
    });

    it('should return 404 for non-existent application', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/applications/550e8400-e29b-41d4-a716-446655440000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should return 401 without auth token', async () => {
      await request(app.getHttpServer()).get(`/api/v1/applications/${applicationId}`).expect(401);
    });
  });

  describe('GET /api/v1/applications/:id/files', () => {
    let pendingApplicationId: string;
    let readyApplicationId: string;

    beforeAll(async () => {
      // Create a PENDING application
      const pendingApp = await prisma.application.create({
        data: {
          userId,
          jobPostingId,
          status: 'PENDING',
        },
      });
      pendingApplicationId = pendingApp.id;

      // Create dummy files for testing
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const fs = require('fs');
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const path = require('path');
      const uploadsDir = path.join(process.cwd(), 'uploads/test');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      fs.writeFileSync(path.join(uploadsDir, 'cover-letter.pdf'), 'dummy cover letter content');
      fs.writeFileSync(path.join(uploadsDir, 'resume.pdf'), 'dummy resume content');

      // Create a READY application with file keys
      const readyApp = await prisma.application.create({
        data: {
          userId,
          jobPostingId,
          status: 'READY',
          coverLetterFileKey: 'test/cover-letter.pdf',
          resumeFileKey: 'test/resume.pdf',
        },
      });
      readyApplicationId = readyApp.id;
    });

    it('should return 400 if application not ready', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/applications/${pendingApplicationId}/files`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.message).toContain('not ready');
    });

    it('should return file URLs when application is ready', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/applications/${readyApplicationId}/files`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.applicationId).toBe(readyApplicationId);
      expect(response.body.coverLetter).toBeDefined();
      expect(response.body.resume).toBeDefined();
      expect(response.body.coverLetter.url).toBeDefined();
      expect(response.body.resume.url).toBeDefined();
      expect(response.body.coverLetter.filename).toContain('cover-letter.pdf');
      expect(response.body.resume.filename).toContain('resume.pdf');
    });

    it('should return 404 for non-existent application', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/applications/550e8400-e29b-41d4-a716-446655440000/files')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should return 401 without auth token', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/applications/${readyApplicationId}/files`)
        .expect(401);
    });
  });
});
