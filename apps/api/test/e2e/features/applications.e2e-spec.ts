import { config } from 'dotenv';
config(); // Load .env before any imports

import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../../src/app.module';
import { PrismaService } from '../../../src/prisma/prisma.service';
import {
  APPLICATION_TITLE_MIN_LENGTH,
  APPLICATION_TITLE_MAX_LENGTH,
} from '../../../src/applications/constants';

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

    it('should return 409 when creating duplicate application for same job posting', async () => {
      // First application should succeed
      const firstResponse = await request(app.getHttpServer())
        .post('/api/v1/applications')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          jobPostingId,
          notes: 'First application',
        })
        .expect(201);

      const firstApplicationId = firstResponse.body.id;

      // Second application for same job posting should fail with 409
      const secondResponse = await request(app.getHttpServer())
        .post('/api/v1/applications')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          jobPostingId,
          notes: 'Duplicate application attempt',
        })
        .expect(409);

      expect(secondResponse.body.message).toContain(
        'Du hast bereits eine Bewerbung für diese Stelle erstellt',
      );

      // Clean up the created application
      await prisma.application.delete({ where: { id: firstApplicationId } });
    });
  });

  describe('GET /api/v1/applications', () => {
    it('should return paginated applications', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/applications')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('items');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.items)).toBe(true);
      expect(response.body.items.length).toBeGreaterThan(0);
      expect(response.body.items[0]).toHaveProperty('id');
      expect(response.body.items[0]).toHaveProperty('status');
      expect(response.body.items[0]).toHaveProperty('jobPostingId');
      expect(response.body.pagination).toMatchObject({
        page: expect.any(Number),
        limit: expect.any(Number),
        total: expect.any(Number),
        totalPages: expect.any(Number),
      });
    });

    it('should include job posting details with query param', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/applications?includeJobPosting=true')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('items');
      if (response.body.items.length > 0) {
        expect(response.body.items[0].jobPosting).toBeDefined();
        expect(response.body.items[0].jobPosting.title).toBeDefined();
        expect(response.body.items[0].jobPosting.company).toBeDefined();
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

  describe('GET /api/v1/applications/:id/stream (SSE)', () => {
    let testApplicationId: string;

    beforeAll(async () => {
      // Create an application in PENDING status for testing
      const application = await prisma.application.create({
        data: {
          userId,
          jobPostingId,
          status: 'PENDING',
          notes: 'SSE test application',
        },
      });
      testApplicationId = application.id;
    });

    afterAll(async () => {
      // Clean up test application
      await prisma.application.delete({
        where: { id: testApplicationId },
      });
    });

    it('should return SSE headers and 200 status', async () => {
      // Test that the SSE endpoint is accessible and returns the correct headers
      // Note: Full SSE streaming testing is complex with supertest
      // We verify the endpoint exists, returns correct status, and has SSE headers
      const response = await request(app.getHttpServer())
        .get(`/api/v1/applications/${testApplicationId}/stream`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept', 'text/event-stream')
        .timeout(3000); // 3 second timeout

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/event-stream');
    });

    it('should return 404 for non-existent application', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/applications/550e8400-e29b-41d4-a716-446655440000/stream')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept', 'text/event-stream')
        .expect(404);
    });

    it('should return 401 without auth token', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/applications/${testApplicationId}/stream`)
        .set('Accept', 'text/event-stream')
        .expect(401);
    });
  });

  describe('PATCH /api/v1/applications/:id/status', () => {
    let applicationId: string;

    beforeAll(async () => {
      // Create a test application for status updates
      const response = await request(app.getHttpServer())
        .post('/api/v1/applications')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          jobPostingId,
          notes: 'Test application for status updates',
        });
      applicationId = response.body.id;
    });

    it('should update application status to INTERVIEW', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/applications/${applicationId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'INTERVIEW',
        })
        .expect(200);

      expect(response.body).toMatchObject({
        id: applicationId,
        applicationStatus: 'INTERVIEW',
      });
      expect(response.body.statusUpdatedAt).toBeDefined();
    });

    it('should update application status to ACCEPTED', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/applications/${applicationId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'ACCEPTED',
        })
        .expect(200);

      expect(response.body).toMatchObject({
        id: applicationId,
        applicationStatus: 'ACCEPTED',
      });
    });

    it('should update application status to REJECTED', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/applications/${applicationId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'REJECTED',
        })
        .expect(200);

      expect(response.body.applicationStatus).toBe('REJECTED');
    });

    it('should return 400 for invalid status', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/applications/${applicationId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'INVALID_STATUS',
        })
        .expect(400);

      expect(response.body.message).toContain('Status must be one of');
    });

    it('should return 401 without auth token', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/applications/${applicationId}/status`)
        .send({
          status: 'INTERVIEW',
        })
        .expect(401);
    });

    it('should return 404 for non-existent application', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/applications/550e8400-e29b-41d4-a716-446655440000/status')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'INTERVIEW',
        })
        .expect(404);
    });
  });

  describe('PATCH /api/v1/applications/:id/title', () => {
    let applicationId: string;

    beforeAll(async () => {
      // Create a test application for title updates
      const response = await request(app.getHttpServer())
        .post('/api/v1/applications')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          jobPostingId,
          notes: 'Test application for title updates',
        });
      applicationId = response.body.id;
    });

    it('should update application title', async () => {
      const newTitle = 'Senior Frontend Developer @ Google';
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/applications/${applicationId}/title`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: newTitle,
        })
        .expect(200);

      expect(response.body).toMatchObject({
        id: applicationId,
        title: newTitle,
      });
    });

    it('should return 400 for title that is too short', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/applications/${applicationId}/title`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'A'.repeat(APPLICATION_TITLE_MIN_LENGTH - 1), // One char less than minimum
        })
        .expect(400);

      expect(response.body.message).toContain(
        `at least ${APPLICATION_TITLE_MIN_LENGTH} characters`,
      );
    });

    it('should return 400 for title that is too long', async () => {
      const longTitle = 'A'.repeat(APPLICATION_TITLE_MAX_LENGTH + 1); // One char more than maximum
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/applications/${applicationId}/title`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: longTitle,
        })
        .expect(400);

      expect(response.body.message).toContain(`at most ${APPLICATION_TITLE_MAX_LENGTH} characters`);
    });

    it('should sanitize title (XSS protection)', async () => {
      const maliciousTitle = '<script>alert("xss")</script>Senior Dev @ Acme';
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/applications/${applicationId}/title`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: maliciousTitle,
        })
        .expect(200);

      // Sanitizer should remove script tags
      expect(response.body.title).not.toContain('<script>');
      expect(response.body.title).toContain('Senior Dev @ Acme');
    });

    it('should return 401 without auth token', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/applications/${applicationId}/title`)
        .send({
          title: 'New Title',
        })
        .expect(401);
    });

    it('should return 404 for non-existent application', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/applications/550e8400-e29b-41d4-a716-446655440000/title')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'New Title',
        })
        .expect(404);
    });
  });

  describe('Application Creation with Auto-Generated Title', () => {
    it('should create application with auto-generated title', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/applications')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          jobPostingId,
          notes: 'Test application with auto-generated title',
        })
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        userId,
        jobPostingId,
        applicationStatus: 'APPLIED', // Default status
        status: 'PENDING', // Generation status
      });

      // Title should be auto-generated (either by LLM or fallback)
      expect(response.body.title).toBeDefined();
      expect(typeof response.body.title).toBe('string');
      expect(response.body.title.length).toBeGreaterThan(0);
      expect(response.body.title.length).toBeLessThanOrEqual(60);
    });
  });
});
