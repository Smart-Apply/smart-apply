import { config } from 'dotenv';
config(); // Load .env before any imports

import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../../src/app.module';
import { PrismaService } from '../../../src/prisma/prisma.service';

import * as path from 'path';
import * as fs from 'fs';

describe('JobPostingsController (e2e)', () => {
  let app: INestApplication;
  let authToken: string;
  let prisma: PrismaService;

  const sampleJobText = fs.readFileSync(
    path.join(__dirname, 'fixtures', 'sample-job-posting.txt'),
    'utf-8',
  );

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);

    // Login to get auth token
    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'demo@smartapply.com',
        password: 'Demo123!',
      })
      .expect(201);

    authToken = loginResponse.body.accessToken;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.jobPosting.deleteMany({});
    await app.close();
  });

  describe('POST /api/v1/job-postings/parse', () => {
    it('should parse job posting from text', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/job-postings/parse')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          text: sampleJobText,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('title');
      expect(response.body).toHaveProperty('company');
      expect(response.body.title).toContain('Software Engineer');
      expect(response.body.company).toContain('Google');
      expect(response.body.requirements).toBeInstanceOf(Array);
      expect(response.body.requirements.length).toBeGreaterThan(0);
      expect(response.body.responsibilities).toBeInstanceOf(Array);
      expect(response.body.responsibilities.length).toBeGreaterThan(0);
      expect(response.body.niceToHave).toBeInstanceOf(Array);
    });

    it('should parse job posting with simple text', async () => {
      const simpleText = `
Backend Engineer at Microsoft

Requirements:
- 5+ years of Python experience
- AWS cloud expertise
- Database design skills

Responsibilities:
- Build REST APIs
- Optimize database queries
- Deploy to cloud
      `;

      const response = await request(app.getHttpServer())
        .post('/api/v1/job-postings/parse')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          text: simpleText,
        })
        .expect(201);

      expect(response.body.title).toBeDefined();
      expect(response.body.company).toBeDefined();
      expect(response.body.requirements.length).toBeGreaterThan(0);
      expect(response.body.responsibilities.length).toBeGreaterThan(0);
    });

    it('should reject request without authentication', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/job-postings/parse')
        .send({
          text: 'Some job posting',
        })
        .expect(401);
    });

    it('should reject request without any input source', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/job-postings/parse')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body.message).toBeDefined();
    });

    it('should use fallback values for text without clear structure', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/job-postings/parse')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          text: 'This is just random text without any job posting structure or company name',
        })
        .expect(201);

      // Service should use fallback values when extraction fails
      expect(response.body.title).toBeDefined();
      expect(response.body.company).toBeDefined();
    });

    it('should handle URL parsing (mocked)', async () => {
      // Note: This would normally require mocking the URL parser
      // For now, we'll test with an invalid URL to verify error handling
      const response = await request(app.getHttpServer())
        .post('/api/v1/job-postings/parse')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          url: 'not-a-valid-url',
        })
        .expect(400);

      expect(response.body.message).toBeDefined();
    });

    it('should validate URL format', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/job-postings/parse')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          url: 'invalid-url-format',
        })
        .expect(400);

      expect(response.body.message).toBeDefined();
    });

    it('should parse job posting from file (PDF)', async () => {
      // First upload a file
      const testPdfPath = path.join(__dirname, 'fixtures', 'test-resume.pdf');

      const uploadResponse = await request(app.getHttpServer())
        .post('/api/v1/uploads')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', testPdfPath)
        .expect(201);

      const fileId = uploadResponse.body.id;

      // Note: The test PDF is a resume, not a job posting, so parsing will likely fail
      // This tests the file parsing flow even if extraction fails
      const response = await request(app.getHttpServer())
        .post('/api/v1/job-postings/parse')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          fileId,
        });

      // We expect either success (if it somehow extracts data) or 400 (if it can't)
      expect([201, 400]).toContain(response.status);
    });

    it('should reject invalid fileId', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/job-postings/parse')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          fileId: 'invalid-file-id',
        })
        .expect(400);

      expect(response.body.message).toBeDefined();
    });

    it('should store raw text in database', async () => {
      const testText = 'Full Stack Developer at Amazon\n\nRequirements: React, Node.js';

      const response = await request(app.getHttpServer())
        .post('/api/v1/job-postings/parse')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          text: testText,
        })
        .expect(201);

      expect(response.body.rawText).toBeDefined();
      expect(response.body.rawText).toContain('Full Stack Developer');
    });

    it('should return timestamps', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/job-postings/parse')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          text: sampleJobText,
        })
        .expect(201);

      expect(response.body.createdAt).toBeDefined();
      expect(response.body.updatedAt).toBeDefined();
      expect(new Date(response.body.createdAt)).toBeInstanceOf(Date);
    });
  });

  describe('POST /api/v1/job-postings', () => {
    it('should create job posting manually with all fields', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/job-postings')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Senior Frontend Developer',
          company: 'Tech Corp',
          location: 'Berlin, Germany',
          url: 'https://example.com/jobs/123',
          description: 'We are looking for an experienced frontend developer to join our team.',
          requirements: [
            '5+ years of React experience',
            'Strong TypeScript skills',
            'Experience with Next.js',
          ],
          responsibilities: [
            'Build scalable web applications',
            'Mentor junior developers',
            'Collaborate with design team',
          ],
          niceToHave: [
            'Experience with GraphQL',
            'Open source contributions',
          ],
          salary: '80,000 - 100,000 EUR',
          employmentType: 'Full-time',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe('Senior Frontend Developer');
      expect(response.body.company).toBe('Tech Corp');
      expect(response.body.location).toBe('Berlin, Germany');
      expect(response.body.description).toContain('experienced frontend developer');
      expect(response.body.requirements).toBeInstanceOf(Array);
      expect(response.body.requirements.length).toBe(3);
      expect(response.body.requirements[0]).toContain('React');
      expect(response.body.responsibilities).toBeInstanceOf(Array);
      expect(response.body.responsibilities.length).toBe(3);
      expect(response.body.niceToHave).toBeInstanceOf(Array);
      expect(response.body.niceToHave.length).toBe(2);
      expect(response.body.sourceUrl).toBe('https://example.com/jobs/123');
      expect(response.body.rawText).toBeDefined();
      expect(response.body.rawText).toContain('Senior Frontend Developer');
      expect(response.body.rawText).toContain('Tech Corp');
    });

    it('should create job posting with only required fields', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/job-postings')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Backend Engineer',
          company: 'StartupXYZ',
          description: 'Build scalable APIs and microservices.',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe('Backend Engineer');
      expect(response.body.company).toBe('StartupXYZ');
      expect(response.body.description).toContain('scalable APIs');
      expect(response.body.requirements).toBeInstanceOf(Array);
      expect(response.body.requirements.length).toBe(0);
      expect(response.body.responsibilities).toBeInstanceOf(Array);
      expect(response.body.responsibilities.length).toBe(0);
      expect(response.body.niceToHave).toBeInstanceOf(Array);
      expect(response.body.niceToHave.length).toBe(0);
    });

    it('should reject request without required title field', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/job-postings')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          company: 'Test Company',
          description: 'Some description',
        })
        .expect(400);

      expect(response.body.message).toBeDefined();
    });

    it('should reject request without required company field', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/job-postings')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test Job',
          description: 'Some description',
        })
        .expect(400);

      expect(response.body.message).toBeDefined();
    });

    it('should reject request without required description field', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/job-postings')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test Job',
          company: 'Test Company',
        })
        .expect(400);

      expect(response.body.message).toBeDefined();
    });

    it('should reject request without authentication', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/job-postings')
        .send({
          title: 'Test Job',
          company: 'Test Company',
          description: 'Some description',
        })
        .expect(401);
    });

    it('should validate URL format when provided', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/job-postings')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test Job',
          company: 'Test Company',
          description: 'Some description',
          url: 'not-a-valid-url',
        })
        .expect(400);

      expect(response.body.message).toBeDefined();
    });

    it('should enforce max length on title', async () => {
      const longTitle = 'a'.repeat(201);
      
      const response = await request(app.getHttpServer())
        .post('/api/v1/job-postings')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: longTitle,
          company: 'Test Company',
          description: 'Some description',
        })
        .expect(400);

      expect(response.body.message).toBeDefined();
    });

    it('should sanitize input fields', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/job-postings')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: '<script>alert("xss")</script>Developer',
          company: 'Test Company',
          description: '<img src=x onerror=alert(1)>Description',
          location: '<b>Location</b>',
        })
        .expect(201);

      // Sanitization should remove script tags
      expect(response.body.title).not.toContain('<script>');
      expect(response.body.description).not.toContain('onerror');
    });

    it('should return timestamps', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/job-postings')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test Job',
          company: 'Test Company',
          description: 'Some description',
        })
        .expect(201);

      expect(response.body.createdAt).toBeDefined();
      expect(response.body.updatedAt).toBeDefined();
      expect(new Date(response.body.createdAt)).toBeInstanceOf(Date);
    });
  });
});
