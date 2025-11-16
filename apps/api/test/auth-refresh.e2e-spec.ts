import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Auth Refresh Token (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);

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

  describe('POST /api/v1/auth/refresh', () => {
    let refreshToken: string;
    let userId: string;

    beforeAll(async () => {
      // Register a test user
      const email = `refresh-test-${Date.now()}@example.com`;
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email,
          password: 'Test123!',
          firstName: 'Test',
          lastName: 'User',
        });

      // Extract cookies
      const setCookie = response.headers['set-cookie'];
      const cookies = Array.isArray(setCookie) ? setCookie : [setCookie].filter(Boolean);
      
      // Extract refresh token from cookie
      const refreshCookie = cookies.find((c: string) => c.startsWith('refresh_token='));
      if (refreshCookie) {
        refreshToken = refreshCookie.split(';')[0].split('=')[1];
      }

      userId = response.body.user.id;
    });

    it('should refresh access token with valid refresh token', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`refresh_token=${refreshToken}`])
        .expect(201);

      expect(response.body).toHaveProperty('message');
      expect(response.headers['set-cookie']).toBeDefined();
      
      // Should set both new access and refresh tokens
      const setCookie = response.headers['set-cookie'];
      const cookies = Array.isArray(setCookie) ? setCookie : [setCookie].filter(Boolean);
      const hasAccessToken = cookies.some((c: string) => c.startsWith('access_token='));
      const hasRefreshToken = cookies.some((c: string) => c.startsWith('refresh_token='));
      
      expect(hasAccessToken).toBe(true);
      expect(hasRefreshToken).toBe(true);
    });

    it('should reject refresh without token', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .expect(401)
        .expect((res) => {
          expect(res.body.message).toContain('Refresh token not found');
        });
    });

    it('should reject invalid refresh token', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', ['refresh_token=invalid-token'])
        .expect(401);
    });

    it('should reject revoked refresh token', async () => {
      // Revoke all tokens for the user
      await prisma.refreshToken.updateMany({
        where: { userId },
        data: { isRevoked: true },
      });

      return request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`refresh_token=${refreshToken}`])
        .expect(401)
        .expect((res) => {
          expect(res.body.message).toContain('Refresh token not found or revoked');
        });
    });

    it('should reject access token used as refresh token', async () => {
      // Login to get fresh tokens
      const email = `access-token-test-${Date.now()}@example.com`;
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email,
          password: 'Test123!',
        });

      const loginResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email,
          password: 'Test123!',
        });

      const setCookie = loginResponse.headers['set-cookie'];
      const cookies = Array.isArray(setCookie) ? setCookie : [setCookie].filter(Boolean);
      const accessCookie = cookies.find((c: string) => c.startsWith('access_token='));
      const accessToken = accessCookie!.split(';')[0].split('=')[1];

      // Try to use access token as refresh token
      return request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`refresh_token=${accessToken}`])
        .expect(401)
        .expect((res) => {
          expect(res.body.message).toContain('Invalid token type');
        });
    });
  });

  describe('Token Rotation', () => {
    it('should revoke old refresh token when issuing new one', async () => {
      // Register new user
      const email = `rotation-test-${Date.now()}@example.com`;
      const registerResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email,
          password: 'Test123!',
        });

      const setCookie = registerResponse.headers['set-cookie'];
      const cookies = Array.isArray(setCookie) ? setCookie : [setCookie].filter(Boolean);
      const refreshCookie = cookies.find((c: string) => c.startsWith('refresh_token='));
      const firstRefreshToken = refreshCookie!.split(';')[0].split('=')[1];

      // Use refresh token to get new pair
      const refreshResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`refresh_token=${firstRefreshToken}`]);

      expect(refreshResponse.status).toBe(201);

      // Try to use old refresh token again (should fail)
      const retryResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`refresh_token=${firstRefreshToken}`]);

      expect(retryResponse.status).toBe(401);
    });
  });

  describe('Max Tokens Per User', () => {
    it('should enforce maximum number of refresh tokens per user', async () => {
      const email = `max-tokens-test-${Date.now()}@example.com`;
      const password = 'Test123!';

      // Register user
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email,
          password,
        });

      // Login 6 times from different "devices" (should revoke oldest)
      for (let i = 0; i < 6; i++) {
        await request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .send({
            email,
            password,
          })
          .set('User-Agent', `Device-${i}`);
      }

      // Get user
      const user = await prisma.user.findUnique({
        where: { email },
        include: {
          refreshTokens: {
            where: {
              isRevoked: false,
              expiresAt: { gt: new Date() },
            },
          },
        },
      });

      // Should have max 5 active tokens
      expect(user!.refreshTokens.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Logout with Refresh Token', () => {
    it('should revoke refresh tokens on logout', async () => {
      const email = `logout-refresh-test-${Date.now()}@example.com`;
      
      // Register and get tokens
      const registerResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email,
          password: 'Test123!',
        });

      const setCookie = registerResponse.headers['set-cookie'];
      const cookies = Array.isArray(setCookie) ? setCookie : [setCookie].filter(Boolean);
      const accessCookie = cookies.find((c: string) => c.startsWith('access_token='));
      const refreshCookie = cookies.find((c: string) => c.startsWith('refresh_token='));

      const userId = registerResponse.body.user.id;

      // Logout
      await request(app.getHttpServer())
        .get('/api/v1/auth/logout')
        .set('Cookie', [accessCookie!])
        .expect(200);

      // Check that refresh tokens are revoked
      const tokens = await prisma.refreshToken.findMany({
        where: {
          userId,
          isRevoked: false,
        },
      });

      expect(tokens.length).toBe(0);

      // Try to use refresh token after logout (should fail)
      const refreshToken = refreshCookie!.split(';')[0].split('=')[1];
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`refresh_token=${refreshToken}`])
        .expect(401);
    });
  });

  describe('Device Tracking', () => {
    it('should store user agent and IP address', async () => {
      const email = `device-tracking-${Date.now()}@example.com`;
      const userAgent = 'Mozilla/5.0 Test Browser';

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email,
          password: 'Test123!',
        })
        .set('User-Agent', userAgent);

      const userId = response.body.user.id;

      // Check database for stored metadata
      const tokens = await prisma.refreshToken.findMany({
        where: { userId },
      });

      expect(tokens.length).toBeGreaterThan(0);
      expect(tokens[0].userAgent).toBe(userAgent);
      expect(tokens[0].ipAddress).toBeDefined();
    });
  });

  describe('Token Expiration', () => {
    it('should reject expired refresh token', async () => {
      const email = `expired-token-test-${Date.now()}@example.com`;
      
      // Register user
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email,
          password: 'Test123!',
        });

      const userId = response.body.user.id;

      // Manually expire all refresh tokens
      await prisma.refreshToken.updateMany({
        where: { userId },
        data: { expiresAt: new Date(Date.now() - 1000) }, // Expired 1 second ago
      });

      // Get refresh token
      const setCookie = response.headers['set-cookie'];
      const cookies = Array.isArray(setCookie) ? setCookie : [setCookie].filter(Boolean);
      const refreshCookie = cookies.find((c: string) => c.startsWith('refresh_token='));
      const refreshToken = refreshCookie!.split(';')[0].split('=')[1];

      // Try to refresh (should fail)
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`refresh_token=${refreshToken}`])
        .expect(401);
    });
  });
});
