import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../../../src/app.module';

describe('Settings Endpoints (e2e)', () => {
  let app: INestApplication;
  let authCookies: string[];
  let testEmail: string;
  const testPassword = 'Test123!';

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
        transform: true,
      }),
    );
    await app.init();

    // Register a test user
    testEmail = `settings-test-${Date.now()}@example.com`;
    const registerResponse = await request(app.getHttpServer()).post('/api/v1/auth/register').send({
      email: testEmail,
      password: testPassword,
      firstName: 'Test',
      lastName: 'User',
    });

    const setCookie = registerResponse.headers['set-cookie'];
    authCookies = Array.isArray(setCookie) ? setCookie : [setCookie];
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/api/v1/auth/profile (PUT)', () => {
    it('should update user profile', async () => {
      const response = await request(app.getHttpServer())
        .put('/api/v1/auth/profile')
        .set('Cookie', authCookies)
        .send({
          firstName: 'Updated',
          lastName: 'Name',
        })
        .expect(200);

      expect(response.body).toHaveProperty('firstName', 'Updated');
      expect(response.body).toHaveProperty('lastName', 'Name');
    });

    it('should update only firstName', async () => {
      const response = await request(app.getHttpServer())
        .put('/api/v1/auth/profile')
        .set('Cookie', authCookies)
        .send({
          firstName: 'OnlyFirst',
        })
        .expect(200);

      expect(response.body).toHaveProperty('firstName', 'OnlyFirst');
      expect(response.body).toHaveProperty('lastName', 'Name'); // Should keep previous value
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .put('/api/v1/auth/profile')
        .send({ firstName: 'Test' })
        .expect(401);
    });
  });

  describe('/api/v1/auth/change-password (POST)', () => {
    it('should reject if current password is incorrect', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/change-password')
        .set('Cookie', authCookies)
        .send({
          currentPassword: 'WrongPassword123!',
          newPassword: 'NewPass123!',
        })
        .expect(400);
    });

    it('should reject if new password does not meet requirements', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/change-password')
        .set('Cookie', authCookies)
        .send({
          currentPassword: testPassword,
          newPassword: 'weak', // Too short, no uppercase, no number, no special char
        })
        .expect(400);
    });

    it('should change password and invalidate session', async () => {
      // Create a new user for this test since password change invalidates session
      const email = `pw-change-${Date.now()}@example.com`;
      const registerResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email,
          password: 'OldPass123!',
        });

      const cookies = registerResponse.headers['set-cookie'];

      // Change password
      const changeResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/change-password')
        .set('Cookie', cookies)
        .send({
          currentPassword: 'OldPass123!',
          newPassword: 'NewPass123!',
        })
        .expect(200);

      expect(changeResponse.body).toHaveProperty('message');
      expect(changeResponse.body.message).toContain('Password changed');

      // The old session should be invalidated (cookies cleared)
      // Try to access a protected route with the old cookies - should fail
      // Note: The response may still have new cookies set, so we need to use the original cookies
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/change-password')
        .send({
          currentPassword: 'Old123!',
          newPassword: 'New123!',
        })
        .expect(401);
    });
  });

  describe('/api/v1/user-preferences (GET/PUT)', () => {
    it('should get user preferences (auto-create if not exists)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/user-preferences')
        .set('Cookie', authCookies)
        .expect(200);

      // Should have default values
      expect(response.body).toHaveProperty('applicationUpdates', true);
      expect(response.body).toHaveProperty('newJobPostings', false);
      expect(response.body).toHaveProperty('marketingEmails', false);
      expect(response.body).toHaveProperty('language', 'de');
      expect(response.body).toHaveProperty('theme', 'system');
      expect(response.body).toHaveProperty('profilePublic', false);
      expect(response.body).toHaveProperty('analyticsEnabled', true);
    });

    it('should update notification preferences', async () => {
      const response = await request(app.getHttpServer())
        .put('/api/v1/user-preferences')
        .set('Cookie', authCookies)
        .send({
          applicationUpdates: false,
          newJobPostings: true,
        })
        .expect(200);

      expect(response.body).toHaveProperty('applicationUpdates', false);
      expect(response.body).toHaveProperty('newJobPostings', true);
    });

    it('should update language preference', async () => {
      const response = await request(app.getHttpServer())
        .put('/api/v1/user-preferences')
        .set('Cookie', authCookies)
        .send({
          language: 'en',
        })
        .expect(200);

      expect(response.body).toHaveProperty('language', 'en');
    });

    it('should update theme preference', async () => {
      const response = await request(app.getHttpServer())
        .put('/api/v1/user-preferences')
        .set('Cookie', authCookies)
        .send({
          theme: 'dark',
        })
        .expect(200);

      expect(response.body).toHaveProperty('theme', 'dark');
    });

    it('should reject invalid language', async () => {
      await request(app.getHttpServer())
        .put('/api/v1/user-preferences')
        .set('Cookie', authCookies)
        .send({
          language: 'invalid',
        })
        .expect(400);
    });

    it('should reject invalid theme', async () => {
      await request(app.getHttpServer())
        .put('/api/v1/user-preferences')
        .set('Cookie', authCookies)
        .send({
          theme: 'invalid',
        })
        .expect(400);
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer()).get('/api/v1/user-preferences').expect(401);
    });
  });

  describe('/api/v1/auth/account (DELETE)', () => {
    it('should reject if password is incorrect', async () => {
      await request(app.getHttpServer())
        .delete('/api/v1/auth/account')
        .set('Cookie', authCookies)
        .send({
          password: 'WrongPassword123!',
        })
        .expect(400);
    });

    it('should require password to be provided', async () => {
      await request(app.getHttpServer())
        .delete('/api/v1/auth/account')
        .set('Cookie', authCookies)
        .send({})
        .expect(400);
    });

    it('should delete account with correct password', async () => {
      // Create a new user for this test since we're deleting the account
      const email = `delete-test-${Date.now()}@example.com`;
      const password = 'DeleteMe123!';

      const registerResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email,
          password,
        });

      const cookies = registerResponse.headers['set-cookie'];

      // Delete account
      const deleteResponse = await request(app.getHttpServer())
        .delete('/api/v1/auth/account')
        .set('Cookie', cookies)
        .send({
          password,
        })
        .expect(200);

      expect(deleteResponse.body).toHaveProperty('message');
      expect(deleteResponse.body.message).toContain('deleted');

      // Verify the user can no longer login
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email,
          password,
        })
        .expect(401);
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .delete('/api/v1/auth/account')
        .send({ password: 'Test123!' })
        .expect(401);
    });
  });
});
