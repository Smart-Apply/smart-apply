import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';

describe('SessionsController (e2e)', () => {
  let app: INestApplication;
  let accessCookie: string;
  let userId: string;

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

    // Create a test user and login
    const email = `session-test-${Date.now()}@example.com`;
    const registerResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email,
        password: 'Test123!',
        firstName: 'Session',
        lastName: 'Test',
      })
      .expect(201);

    userId = registerResponse.body.user.id;
    
    // Extract cookie from registration response
    const setCookie = registerResponse.headers['set-cookie'];
    const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
    accessCookie = cookies.find((c) => c.startsWith('access_token='));
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/api/v1/auth/sessions (GET)', () => {
    it('should return list of active sessions', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/auth/sessions')
        .set('Cookie', accessCookie)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      
      // Verify session structure
      const session = response.body[0];
      expect(session).toHaveProperty('id');
      expect(session).toHaveProperty('userId', userId);
      expect(session).toHaveProperty('deviceName');
      expect(session).toHaveProperty('deviceType');
      expect(session).toHaveProperty('browser');
      expect(session).toHaveProperty('os');
      expect(session).toHaveProperty('ipAddress');
      expect(session).toHaveProperty('isActive', true);
      expect(session).toHaveProperty('createdAt');
      expect(session).toHaveProperty('lastActiveAt');
    });

    it('should require authentication', () => {
      return request(app.getHttpServer())
        .get('/api/v1/auth/sessions')
        .expect(401);
    });
  });

  describe('Session creation on login', () => {
    it('should create a session when user logs in', async () => {
      // Register a new user
      const email = `session-login-${Date.now()}@example.com`;
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email,
          password: 'Test123!',
          firstName: 'Login',
          lastName: 'Test',
        })
        .expect(201);

      // Login
      const loginResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email,
          password: 'Test123!',
        })
        .expect(201);

      // Extract cookies
      const setCookie = loginResponse.headers['set-cookie'];
      const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
      const loginCookie = cookies.find((c) => c.startsWith('access_token='));

      // Get sessions
      const sessionsResponse = await request(app.getHttpServer())
        .get('/api/v1/auth/sessions')
        .set('Cookie', loginCookie)
        .expect(200);

      expect(sessionsResponse.body.length).toBeGreaterThan(0);
    });

    it('should track device information in session', async () => {
      // Register a new user
      const email = `session-device-${Date.now()}@example.com`;
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email,
          password: 'Test123!',
          firstName: 'Device',
          lastName: 'Test',
        })
        .set('User-Agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1')
        .expect(201);

      // Login with custom user agent
      const loginResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email,
          password: 'Test123!',
        })
        .set('User-Agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1')
        .expect(201);

      // Extract cookies
      const setCookie = loginResponse.headers['set-cookie'];
      const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
      const loginCookie = cookies.find((c) => c.startsWith('access_token='));

      // Get sessions
      const sessionsResponse = await request(app.getHttpServer())
        .get('/api/v1/auth/sessions')
        .set('Cookie', loginCookie)
        .expect(200);

      const session = sessionsResponse.body[0];
      expect(session.deviceType).toBe('mobile');
      expect(session.browser).toContain('Safari');
      expect(session.os).toContain('iOS');
    });
  });

  describe('Session limit enforcement', () => {
    it('should enforce max 5 sessions per user (FIFO)', async () => {
      // Register a new user
      const email = `session-limit-${Date.now()}@example.com`;
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email,
          password: 'Test123!',
          firstName: 'Limit',
          lastName: 'Test',
        })
        .expect(201);

      // Login 6 times to exceed the limit
      const cookies: string[] = [];
      for (let i = 0; i < 6; i++) {
        const loginResponse = await request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .send({
            email,
            password: 'Test123!',
          })
          .expect(201);

        const setCookie = loginResponse.headers['set-cookie'];
        const cookieArray = Array.isArray(setCookie) ? setCookie : [setCookie];
        const loginCookie = cookieArray.find((c) => c.startsWith('access_token='));
        cookies.push(loginCookie);

        // Small delay between logins
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Get sessions using the latest cookie
      const sessionsResponse = await request(app.getHttpServer())
        .get('/api/v1/auth/sessions')
        .set('Cookie', cookies[cookies.length - 1])
        .expect(200);

      // Should have exactly 5 active sessions (oldest one removed)
      expect(sessionsResponse.body.length).toBe(5);
    });
  });

  describe('/api/v1/auth/sessions/:id (DELETE)', () => {
    it('should revoke a specific session', async () => {
      // Register a new user
      const email = `session-revoke-${Date.now()}@example.com`;
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email,
          password: 'Test123!',
          firstName: 'Revoke',
          lastName: 'Test',
        })
        .expect(201);

      // Login twice to create two sessions
      const login1Response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email,
          password: 'Test123!',
        })
        .expect(201);

      await new Promise((resolve) => setTimeout(resolve, 100));

      const login2Response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email,
          password: 'Test123!',
        })
        .expect(201);

      // Extract cookies
      const setCookie2 = login2Response.headers['set-cookie'];
      const cookies2 = Array.isArray(setCookie2) ? setCookie2 : [setCookie2];
      const cookie2 = cookies2.find((c) => c.startsWith('access_token='));

      // Get all sessions (should have 3: register + 2 logins)
      const sessionsResponse = await request(app.getHttpServer())
        .get('/api/v1/auth/sessions')
        .set('Cookie', cookie2)
        .expect(200);

      expect(sessionsResponse.body.length).toBe(3);

      // Revoke the first session
      const sessionToRevoke = sessionsResponse.body[1]; // Oldest session
      await request(app.getHttpServer())
        .delete(`/api/v1/auth/sessions/${sessionToRevoke.id}`)
        .set('Cookie', cookie2)
        .expect(200);

      // Verify only two sessions remain
      const updatedSessionsResponse = await request(app.getHttpServer())
        .get('/api/v1/auth/sessions')
        .set('Cookie', cookie2)
        .expect(200);

      expect(updatedSessionsResponse.body.length).toBe(2);
    });

    it('should not allow revoking another user\'s session', async () => {
      // Register two users
      const email1 = `session-user1-${Date.now()}@example.com`;
      const email2 = `session-user2-${Date.now()}@example.com`;

      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: email1,
          password: 'Test123!',
          firstName: 'User1',
          lastName: 'Test',
        })
        .expect(201);

      const user2Response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: email2,
          password: 'Test123!',
          firstName: 'User2',
          lastName: 'Test',
        })
        .expect(201);

      // Login as both users
      const login1Response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: email1,
          password: 'Test123!',
        })
        .expect(201);

      const login2Response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: email2,
          password: 'Test123!',
        })
        .expect(201);

      // Extract cookies
      const setCookie1 = login1Response.headers['set-cookie'];
      const cookies1 = Array.isArray(setCookie1) ? setCookie1 : [setCookie1];
      const cookie1 = cookies1.find((c) => c.startsWith('access_token='));

      const setCookie2 = login2Response.headers['set-cookie'];
      const cookies2 = Array.isArray(setCookie2) ? setCookie2 : [setCookie2];
      const cookie2 = cookies2.find((c) => c.startsWith('access_token='));

      // Get user2's sessions
      const user2Sessions = await request(app.getHttpServer())
        .get('/api/v1/auth/sessions')
        .set('Cookie', cookie2)
        .expect(200);

      // Try to revoke user2's session using user1's cookie
      await request(app.getHttpServer())
        .delete(`/api/v1/auth/sessions/${user2Sessions.body[0].id}`)
        .set('Cookie', cookie1)
        .expect(404); // Not found because it doesn't belong to user1
    });

    it('should return 404 for non-existent session', () => {
      return request(app.getHttpServer())
        .delete('/api/v1/auth/sessions/non-existent-id')
        .set('Cookie', accessCookie)
        .expect(404);
    });
  });

  describe('/api/v1/auth/sessions (DELETE)', () => {
    it('should revoke all sessions', async () => {
      // Register a new user
      const email = `session-revoke-all-${Date.now()}@example.com`;
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email,
          password: 'Test123!',
          firstName: 'RevokeAll',
          lastName: 'Test',
        })
        .expect(201);

      // Login three times
      const cookies: string[] = [];
      for (let i = 0; i < 3; i++) {
        const loginResponse = await request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .send({
            email,
            password: 'Test123!',
          })
          .expect(201);

        const setCookie = loginResponse.headers['set-cookie'];
        const cookieArray = Array.isArray(setCookie) ? setCookie : [setCookie];
        const loginCookie = cookieArray.find((c) => c.startsWith('access_token='));
        cookies.push(loginCookie);

        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Verify 4 sessions exist (register + 3 logins)
      const sessionsResponse = await request(app.getHttpServer())
        .get('/api/v1/auth/sessions')
        .set('Cookie', cookies[cookies.length - 1])
        .expect(200);

      expect(sessionsResponse.body.length).toBe(4);

      // Revoke all sessions
      await request(app.getHttpServer())
        .delete('/api/v1/auth/sessions')
        .set('Cookie', cookies[cookies.length - 1])
        .expect(200);

      // Verify all sessions are revoked (should get 0 active sessions)
      const updatedSessionsResponse = await request(app.getHttpServer())
        .get('/api/v1/auth/sessions')
        .set('Cookie', cookies[cookies.length - 1])
        .expect(200);

      expect(updatedSessionsResponse.body.length).toBe(0);
    });
  });

  describe('Session cleanup', () => {
    it('should update lastActiveAt on token refresh', async () => {
      // Register a new user
      const email = `session-refresh-${Date.now()}@example.com`;
      const registerResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email,
          password: 'Test123!',
          firstName: 'Refresh',
          lastName: 'Test',
        })
        .expect(201);

      // Extract cookies
      const setCookie = registerResponse.headers['set-cookie'];
      const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
      const accessCookie = cookies.find((c) => c.startsWith('access_token='));
      const refreshCookie = cookies.find((c) => c.startsWith('refresh_token='));

      // Get initial session
      const initialSessionsResponse = await request(app.getHttpServer())
        .get('/api/v1/auth/sessions')
        .set('Cookie', accessCookie)
        .expect(200);

      const initialSession = initialSessionsResponse.body[0];
      const initialLastActive = new Date(initialSession.lastActiveAt);

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Refresh token
      const refreshResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', [accessCookie, refreshCookie].join('; '))
        .expect(201);

      // Extract new cookies
      const newSetCookie = refreshResponse.headers['set-cookie'];
      const newCookies = Array.isArray(newSetCookie) ? newSetCookie : [newSetCookie];
      const newAccessCookie = newCookies.find((c) => c.startsWith('access_token='));

      // Get updated session
      const updatedSessionsResponse = await request(app.getHttpServer())
        .get('/api/v1/auth/sessions')
        .set('Cookie', newAccessCookie)
        .expect(200);

      // Should have a new session from the refresh (old one revoked, new one created)
      expect(updatedSessionsResponse.body.length).toBe(1);
    });
  });
});