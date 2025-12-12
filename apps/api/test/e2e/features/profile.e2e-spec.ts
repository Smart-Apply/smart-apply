import { config } from 'dotenv';
config(); // Load .env before any imports

import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../../src/app.module';
import { PrismaService } from '../../../src/prisma/prisma.service';

describe('ProfileController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1'); // Set global prefix like in main.ts
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

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

  describe('GET /api/v1/profile', () => {
    it('should return profile for authenticated user', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body.userId).toBe(userId);
      expect(response.body).toHaveProperty('skills');
      expect(response.body).toHaveProperty('certificates');
      expect(response.body).toHaveProperty('experiences');
      expect(response.body).toHaveProperty('projects');
    });

    it('should return 401 without auth token', async () => {
      await request(app.getHttpServer()).get('/api/v1/profile').expect(401);
    });
  });

  describe('PUT /api/v1/profile', () => {
    it('should update profile with basic fields', async () => {
      const updateData = {
        fullName: 'John Updated',
        phone: '+1234567890',
        location: 'San Francisco, CA',
        summary: 'Updated summary',
      };

      const response = await request(app.getHttpServer())
        .put('/api/v1/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.fullName).toBe(updateData.fullName);
      expect(response.body.phone).toBe(updateData.phone);
      expect(response.body.location).toBe(updateData.location);
      expect(response.body.summary).toBe(updateData.summary);
    });

    it('should update profile with skills', async () => {
      const updateData = {
        skills: [
          { name: 'TypeScript', level: 'Expert' },
          { name: 'NestJS', level: 'Advanced' },
        ],
      };

      const response = await request(app.getHttpServer())
        .put('/api/v1/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.skills).toHaveLength(2);
      expect(response.body.skills[0].name).toBe('TypeScript');
      expect(response.body.skills[1].name).toBe('NestJS');
    });

    it('should update profile with experiences', async () => {
      const updateData = {
        experiences: [
          {
            title: 'Senior Engineer',
            company: 'TechCorp',
            startDate: '2020-01-01',
            endDate: '2023-12-31',
            description: 'Worked on backend',
          },
        ],
      };

      const response = await request(app.getHttpServer())
        .put('/api/v1/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.experiences).toHaveLength(1);
      expect(response.body.experiences[0].title).toBe('Senior Engineer');
      expect(response.body.experiences[0].company).toBe('TechCorp');
    });

    it('should update profile with certificates', async () => {
      const updateData = {
        certificates: [
          {
            name: 'AWS Solutions Architect',
            issuer: 'Amazon Web Services',
            dateObtained: '2023-05-15',
          },
        ],
      };

      const response = await request(app.getHttpServer())
        .put('/api/v1/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.certificates).toHaveLength(1);
      expect(response.body.certificates[0].name).toBe('AWS Solutions Architect');
    });

    it('should update profile with projects', async () => {
      const updateData = {
        projects: [
          {
            name: 'E-Commerce Platform',
            description: 'Built with NestJS',
            technologies: ['TypeScript', 'PostgreSQL'],
            url: 'https://github.com/user/project',
          },
        ],
      };

      const response = await request(app.getHttpServer())
        .put('/api/v1/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.projects).toHaveLength(1);
      expect(response.body.projects[0].name).toBe('E-Commerce Platform');
      expect(response.body.projects[0].technologies).toEqual(['TypeScript', 'PostgreSQL']);
    });

    it('should validate invalid data', async () => {
      const updateData = {
        linkedinUrl: 'not-a-valid-url',
      };

      await request(app.getHttpServer())
        .put('/api/v1/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(400);
    });

    it('should reject invalid phone number format', async () => {
      const testCases = [
        { phone: 'call me', description: 'text instead of number' },
        { phone: '123', description: 'too short' },
        { phone: 'abc123', description: 'contains letters' },
      ];

      for (const testCase of testCases) {
        const response = await request(app.getHttpServer())
          .put('/api/v1/profile')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ phone: testCase.phone })
          .expect(400);

        expect(response.body.message).toContain('Phone number must be in international format');
      }
    });

    it('should accept valid phone numbers', async () => {
      const validPhones = [
        '+49123456789',    // Germany
        '+1234567890',     // US
        '+441234567890',   // UK
        '',                // Empty string (optional field)
      ];

      for (const phone of validPhones) {
        await request(app.getHttpServer())
          .put('/api/v1/profile')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ phone })
          .expect(200);
      }
    });

    it('should return 401 without auth token', async () => {
      await request(app.getHttpServer())
        .put('/api/v1/profile')
        .send({ fullName: 'Test' })
        .expect(401);
    });
  });
});
