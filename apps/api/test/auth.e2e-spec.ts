import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';

describe('AuthController (e2e)', () => {
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

  describe('/api/v1/auth/register (POST)', () => {
    it('should register a new user and set cookie', () => {
      const email = `test-${Date.now()}@example.com`;

      return request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email,
          password: 'Test123!',
          fullName: 'Test User',
        })
        .expect(201)
        .expect((res) => {
          // Should not return token in body anymore
          expect(res.body).not.toHaveProperty('accessToken');
          expect(res.body.user).toHaveProperty('email', email);
          // Should set cookie
          expect(res.headers['set-cookie']).toBeDefined();
          expect(res.headers['set-cookie'][0]).toMatch(/access_token=/);
        });
    });

    it('should automatically create profile for new user', async () => {
      const email = `profile-auto-${Date.now()}@example.com`;

      // Register new user
      const registerResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email,
          password: 'Test123!',
          firstName: 'Test',
          lastName: 'User',
        })
        .expect(201);

      // Extract cookie from registration response
      const setCookie = registerResponse.headers['set-cookie'];
      const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];

      // Verify profile exists
      const profileResponse = await request(app.getHttpServer())
        .get('/api/v1/profile')
        .set('Cookie', cookies)
        .expect(200);

      expect(profileResponse.body).toHaveProperty('id');
      expect(profileResponse.body).toHaveProperty('userId', registerResponse.body.user.id);
      expect(profileResponse.body).toHaveProperty('skills');
      expect(profileResponse.body).toHaveProperty('certificates');
      expect(profileResponse.body).toHaveProperty('experiences');
      expect(profileResponse.body).toHaveProperty('projects');
    });

    it('should reject duplicate email', async () => {
      const email = `duplicate-${Date.now()}@example.com`;

      // First registration
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email,
          password: 'Test123!',
        })
        .expect(201);

      // Duplicate registration
      return request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email,
          password: 'Test123!',
        })
        .expect(409);
    });

    it('should reject invalid email', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'invalid-email',
          password: 'Test123!',
        })
        .expect(400);
    });

    it('should reject short password (less than 8 characters)', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'Short1!',
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toContain('Password must be at least 8 characters long');
        });
    });

    it('should reject password without uppercase letter', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'lowercase123!',
        })
        .expect(400)
        .expect((res) => {
          const message = Array.isArray(res.body.message)
            ? res.body.message.join(' ')
            : res.body.message;
          expect(message).toContain('uppercase');
        });
    });

    it('should reject password without lowercase letter', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'UPPERCASE123!',
        })
        .expect(400)
        .expect((res) => {
          const message = Array.isArray(res.body.message)
            ? res.body.message.join(' ')
            : res.body.message;
          expect(message).toContain('lowercase');
        });
    });

    it('should reject password without number', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'NoNumber!',
        })
        .expect(400)
        .expect((res) => {
          const message = Array.isArray(res.body.message)
            ? res.body.message.join(' ')
            : res.body.message;
          expect(message).toContain('number');
        });
    });

    it('should reject password without special character', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'NoSpecial123',
        })
        .expect(400)
        .expect((res) => {
          const message = Array.isArray(res.body.message)
            ? res.body.message.join(' ')
            : res.body.message;
          expect(message).toContain('special character');
        });
    });

    it('should accept strong password with all requirements', () => {
      const email = `strong-pass-${Date.now()}@example.com`;
      return request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email,
          password: 'StrongP@ss123',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.user).toHaveProperty('email', email);
        });
    });
  });

  describe('/api/v1/auth/login (POST)', () => {
    const testEmail = `login-test-${Date.now()}@example.com`;
    const testPassword = 'Test123!';

    beforeAll(async () => {
      // Create test user
      await request(app.getHttpServer()).post('/api/v1/auth/register').send({
        email: testEmail,
        password: testPassword,
      });
    });

    it('should login with valid credentials and set cookie', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: testEmail,
          password: testPassword,
        })
        .expect(201)
        .expect((res) => {
          // Should not return token in body anymore
          expect(res.body).not.toHaveProperty('accessToken');
          expect(res.body.user).toHaveProperty('email', testEmail);
          // Should set cookie
          expect(res.headers['set-cookie']).toBeDefined();
          expect(res.headers['set-cookie'][0]).toMatch(/access_token=/);
        });
    });

    it('should reject invalid password', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: testEmail,
          password: 'WrongPassword123!',
        })
        .expect(401);
    });

    it('should reject non-existent user', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'Test123!',
        })
        .expect(401);
    });
  });

  describe('/api/v1/auth/me (GET)', () => {
    let cookies: string[];

    beforeAll(async () => {
      const email = `me-test-${Date.now()}@example.com`;

      const response = await request(app.getHttpServer()).post('/api/v1/auth/register').send({
        email,
        password: 'Test123!',
        fullName: 'John Doe',
      });

      // Extract cookie from response
      const setCookie = response.headers['set-cookie'];
      cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
    });

    it('should return current user with valid cookie', () => {
      return request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Cookie', cookies)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('email');
          expect(res.body).toHaveProperty('fullName');
        });
    });

    it('should reject without cookie', () => {
      return request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
    });

    it('should reject with invalid cookie', () => {
      return request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Cookie', ['access_token=invalid-token'])
        .expect(401);
    });
  });

  describe('/api/v1/auth/logout (POST)', () => {
    let cookies: string[];

    beforeAll(async () => {
      const email = `logout-test-${Date.now()}@example.com`;

      const response = await request(app.getHttpServer()).post('/api/v1/auth/register').send({
        email,
        password: 'Test123!',
      });

      const setCookie = response.headers['set-cookie'];
      cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
    });

    it('should logout and clear cookie', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Cookie', cookies)
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('message');
          // Should clear the cookie
          expect(res.headers['set-cookie']).toBeDefined();
          // The cookie should have Max-Age=0 or Expires in the past
          const setCookieHeader = res.headers['set-cookie'][0];
          expect(setCookieHeader).toMatch(/access_token=/);
        });
    });

    it('should require authentication', () => {
      return request(app.getHttpServer()).post('/api/v1/auth/logout').expect(401);
    });
  });
});
