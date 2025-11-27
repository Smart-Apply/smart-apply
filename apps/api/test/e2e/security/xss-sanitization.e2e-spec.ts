import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../../../src/app.module';

/**
 * XSS Sanitization E2E Tests
 *
 * Tests input sanitization across all DTOs to prevent XSS attacks.
 * Verifies that malicious scripts are properly escaped at the backend.
 */
describe('XSS Sanitization (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;
  let userId: string;

  // Common XSS attack payloads
  const XSS_PAYLOADS = {
    script: '<script>alert("XSS")</script>',
    img: '<img src=x onerror=alert("XSS")>',
    svg: '<svg onload=alert("XSS")>',
    iframe: '<iframe src="javascript:alert(\'XSS\')">',
    javascript: 'javascript:alert("XSS")',
    mixed: 'Hello<script>alert("XSS")</script>World',
  };

  // Expected sanitized outputs (HTML entities escaped)
  const SANITIZED = {
    script: '&lt;script&gt;alert(&quot;XSS&quot;)&lt;&#x2F;script&gt;',
    img: '&lt;img src=x onerror=alert(&quot;XSS&quot;)&gt;',
    svg: '&lt;svg onload=alert(&quot;XSS&quot;)&gt;',
    iframe: '&lt;iframe src=&quot;javascript:alert(&#x27;XSS&#x27;)&quot;&gt;',
    javascript: 'javascript:alert(&quot;XSS&quot;)',
    mixed: 'Hello&lt;script&gt;alert(&quot;XSS&quot;)&lt;&#x2F;script&gt;World',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api/v1');

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true, // Enable transformation for sanitization decorators
      }),
    );

    await app.init();

    // Register and login a test user
    const email = `xss-test-${Date.now()}@example.com`;
    const registerRes = await request(app.getHttpServer()).post('/api/v1/auth/register').send({
      email,
      password: 'Test123!',
      firstName: 'XSS',
      lastName: 'Tester',
    });

    // Extract token from cookie
    const cookies = registerRes.headers['set-cookie'];
    const cookieArray = Array.isArray(cookies) ? cookies : [cookies];
    const tokenCookie = cookieArray.find((c: string) => c.startsWith('access_token='));
    if (tokenCookie) {
      accessToken = tokenCookie.split('=')[1].split(';')[0];
    }
    userId = registerRes.body.user.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Auth - Registration', () => {
    it('should sanitize firstName with XSS payload', async () => {
      const email = `sanitize-first-${Date.now()}@example.com`;

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email,
          password: 'Test123!',
          firstName: XSS_PAYLOADS.script,
          lastName: 'Safe',
        })
        .expect(201);

      expect(res.body.user.firstName).toBe(SANITIZED.script);
    });

    it('should sanitize lastName with XSS payload', async () => {
      const email = `sanitize-last-${Date.now()}@example.com`;

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email,
          password: 'Test123!',
          firstName: 'Safe',
          lastName: XSS_PAYLOADS.img,
        })
        .expect(201);

      expect(res.body.user.lastName).toBe(SANITIZED.img);
    });
  });

  describe('Profile - Update', () => {
    it('should sanitize summary field', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/v1/profile')
        .set('Cookie', `access_token=${accessToken}`)
        .send({
          summary: XSS_PAYLOADS.mixed,
        })
        .expect(200);

      expect(res.body.summary).toBe(SANITIZED.mixed);
    });

    it('should sanitize location field', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/v1/profile')
        .set('Cookie', `access_token=${accessToken}`)
        .send({
          location: XSS_PAYLOADS.iframe,
        })
        .expect(200);

      expect(res.body.location).toBe(SANITIZED.iframe);
    });
  });

  describe('Profile - Skills', () => {
    it('should sanitize skill name', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/v1/profile')
        .set('Cookie', `access_token=${accessToken}`)
        .send({
          skills: [
            {
              name: XSS_PAYLOADS.script,
              level: 'Expert',
            },
          ],
        })
        .expect(200);

      expect(res.body.skills[0].name).toBe(SANITIZED.script);
    });

    it('should sanitize skill level', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/v1/profile')
        .set('Cookie', `access_token=${accessToken}`)
        .send({
          skills: [
            {
              name: `XSS-Test-Skill-${Date.now()}`,
              level: XSS_PAYLOADS.img,
            },
          ],
        })
        .expect(200);

      // Find the skill we just created
      const skill = res.body.skills.find((s: any) => s.name.startsWith('XSS-Test-Skill-'));
      expect(skill).toBeDefined();
      expect(skill.level).toBe(SANITIZED.img);
    });
  });

  describe('Profile - Experience', () => {
    it('should sanitize experience fields', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/v1/profile')
        .set('Cookie', `access_token=${accessToken}`)
        .send({
          experiences: [
            {
              title: XSS_PAYLOADS.script,
              company: XSS_PAYLOADS.img,
              location: XSS_PAYLOADS.svg,
              description: XSS_PAYLOADS.mixed,
              startDate: '2020-01-01',
              current: true,
            },
          ],
        })
        .expect(200);

      const exp = res.body.experiences[0];
      expect(exp.title).toBe(SANITIZED.script);
      expect(exp.company).toBe(SANITIZED.img);
      expect(exp.description).toBe(SANITIZED.mixed);
    });
  });

  describe('Profile - Education', () => {
    it('should sanitize education fields', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/v1/profile')
        .set('Cookie', `access_token=${accessToken}`)
        .send({
          education: [
            {
              degree: XSS_PAYLOADS.script,
              institution: XSS_PAYLOADS.img,
              fieldOfStudy: XSS_PAYLOADS.svg,
              description: XSS_PAYLOADS.mixed,
              startYear: '2018-09-01',
              endYear: '2022-06-01',
            },
          ],
        })
        .expect(200);

      const edu = res.body.education[0];
      expect(edu.degree).toBe(SANITIZED.script);
      expect(edu.institution).toBe(SANITIZED.img);
      expect(edu.fieldOfStudy).toBe(SANITIZED.svg);
      expect(edu.description).toBe(SANITIZED.mixed);
    });
  });

  describe('Profile - Certificates', () => {
    it('should sanitize certificate fields', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/v1/profile')
        .set('Cookie', `access_token=${accessToken}`)
        .send({
          certificates: [
            {
              name: XSS_PAYLOADS.script,
              issuer: XSS_PAYLOADS.img,
              dateObtained: '2023-01-01',
            },
          ],
        })
        .expect(200);

      const cert = res.body.certificates[0];
      expect(cert.name).toBe(SANITIZED.script);
      expect(cert.issuer).toBe(SANITIZED.img);
    });
  });

  describe('Profile - Projects', () => {
    it('should sanitize project fields', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/v1/profile')
        .set('Cookie', `access_token=${accessToken}`)
        .send({
          projects: [
            {
              name: XSS_PAYLOADS.script,
              description: XSS_PAYLOADS.mixed,
              technologies: [XSS_PAYLOADS.img, XSS_PAYLOADS.svg],
            },
          ],
        })
        .expect(200);

      const project = res.body.projects[0];
      expect(project.name).toBe(SANITIZED.script);
      expect(project.description).toBe(SANITIZED.mixed);
      expect(project.technologies[0]).toBe(SANITIZED.img);
      expect(project.technologies[1]).toBe(SANITIZED.svg);
    });
  });

  describe('Job Postings - Parse', () => {
    it('should sanitize job posting text', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/job-postings/parse')
        .set('Cookie', `access_token=${accessToken}`)
        .send({
          text: XSS_PAYLOADS.mixed,
        })
        .expect(201);

      // Job posting text should be sanitized before parsing
      expect(res.body.rawText || res.body.description).toContain('&lt;script&gt;');
    });
  });

  describe('Applications - Notes', () => {
    let jobPostingId: string;

    beforeAll(async () => {
      // Create a job posting first
      const jobRes = await request(app.getHttpServer())
        .post('/api/v1/job-postings/parse')
        .set('Cookie', `access_token=${accessToken}`)
        .send({
          text: 'Software Engineer position at TechCorp',
        });

      jobPostingId = jobRes.body.id;
    });

    it('should sanitize application notes', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/applications')
        .set('Cookie', `access_token=${accessToken}`)
        .send({
          jobPostingId,
          notes: XSS_PAYLOADS.script,
        })
        .expect(201);

      expect(res.body.notes).toBe(SANITIZED.script);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty strings', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/v1/profile')
        .set('Cookie', `access_token=${accessToken}`)
        .send({
          summary: '',
        })
        .expect(200);

      expect(res.body.summary).toBe('');
    });

    it('should trim whitespace before sanitizing', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/v1/profile')
        .set('Cookie', `access_token=${accessToken}`)
        .send({
          summary: '  Normal Summary  ',
        })
        .expect(200);

      expect(res.body.summary).toBe('Normal Summary');
    });

    it('should preserve legitimate special characters after escaping', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/v1/profile')
        .set('Cookie', `access_token=${accessToken}`)
        .send({
          summary: 'Experienced in C++ & Java',
        })
        .expect(200);

      // & should be escaped to &amp;
      expect(res.body.summary).toBe('Experienced in C++ &amp; Java');
    });
  });
});
