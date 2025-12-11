import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../../src/app.module';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { SessionService } from '../../../src/auth/session.service';
import {
  REVOKED_SESSION_CLEANUP_DAYS,
  OLD_SESSION_CLEANUP_DAYS,
  REVOKED_REFRESH_TOKEN_CLEANUP_DAYS,
} from '../../../src/auth/session.constants';

describe('Session and Refresh Token Cleanup (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sessionService: SessionService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    sessionService = app.get<SessionService>(SessionService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('cleanupExpiredSessions', () => {
    it('should delete expired sessions', async () => {
      // Create a test user
      const user = await prisma.user.create({
        data: {
          email: `cleanup-expired-${Date.now()}@example.com`,
          password: 'hashedPassword',
          firstName: 'Cleanup',
          lastName: 'Test',
        },
      });

      // Create a refresh token
      const refreshToken = await prisma.refreshToken.create({
        data: {
          token: 'test-token-expired',
          userId: user.id,
          expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Expired 1 day ago
        },
      });

      // Create an expired session
      const expiredSession = await prisma.session.create({
        data: {
          userId: user.id,
          refreshTokenId: refreshToken.id,
          ipAddress: '127.0.0.1',
          expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Expired 1 day ago
          isActive: true,
        },
      });

      // Run cleanup
      const deletedCount = await sessionService.cleanupExpiredSessions();

      // Verify session was deleted
      const session = await prisma.session.findUnique({
        where: { id: expiredSession.id },
      });

      expect(session).toBeNull();
      expect(deletedCount).toBeGreaterThanOrEqual(1);

      // Cleanup test user
      await prisma.user.delete({ where: { id: user.id } });
    });

    it('should delete revoked sessions older than REVOKED_SESSION_CLEANUP_DAYS', async () => {
      // Create a test user
      const user = await prisma.user.create({
        data: {
          email: `cleanup-revoked-${Date.now()}@example.com`,
          password: 'hashedPassword',
          firstName: 'Cleanup',
          lastName: 'Test',
        },
      });

      // Create a refresh token
      const refreshToken = await prisma.refreshToken.create({
        data: {
          token: 'test-token-revoked',
          userId: user.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Valid for 7 days
        },
      });

      // Create a revoked session older than cleanup threshold
      const oldRevokedDate = new Date(Date.now() - (REVOKED_SESSION_CLEANUP_DAYS + 1) * 24 * 60 * 60 * 1000);
      const revokedSession = await prisma.session.create({
        data: {
          userId: user.id,
          refreshTokenId: refreshToken.id,
          ipAddress: '127.0.0.1',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Not expired
          isActive: false,
          revokedAt: oldRevokedDate,
        },
      });

      // Run cleanup
      const deletedCount = await sessionService.cleanupExpiredSessions();

      // Verify session was deleted
      const session = await prisma.session.findUnique({
        where: { id: revokedSession.id },
      });

      expect(session).toBeNull();
      expect(deletedCount).toBeGreaterThanOrEqual(1);

      // Cleanup test user
      await prisma.user.delete({ where: { id: user.id } });
    });

    it('should delete sessions older than OLD_SESSION_CLEANUP_DAYS', async () => {
      // Create a test user
      const user = await prisma.user.create({
        data: {
          email: `cleanup-old-${Date.now()}@example.com`,
          password: 'hashedPassword',
          firstName: 'Cleanup',
          lastName: 'Test',
        },
      });

      // Create a refresh token
      const refreshToken = await prisma.refreshToken.create({
        data: {
          token: 'test-token-old',
          userId: user.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      // Create a very old session (older than OLD_SESSION_CLEANUP_DAYS)
      const oldDate = new Date(Date.now() - (OLD_SESSION_CLEANUP_DAYS + 1) * 24 * 60 * 60 * 1000);
      const oldSession = await prisma.session.create({
        data: {
          userId: user.id,
          refreshTokenId: refreshToken.id,
          ipAddress: '127.0.0.1',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Not expired
          isActive: true,
          createdAt: oldDate,
        },
      });

      // Run cleanup
      const deletedCount = await sessionService.cleanupExpiredSessions();

      // Verify session was deleted
      const session = await prisma.session.findUnique({
        where: { id: oldSession.id },
      });

      expect(session).toBeNull();
      expect(deletedCount).toBeGreaterThanOrEqual(1);

      // Cleanup test user
      await prisma.user.delete({ where: { id: user.id } });
    });

    it('should NOT delete active, non-expired sessions', async () => {
      // Create a test user
      const user = await prisma.user.create({
        data: {
          email: `cleanup-active-${Date.now()}@example.com`,
          password: 'hashedPassword',
          firstName: 'Cleanup',
          lastName: 'Test',
        },
      });

      // Create a refresh token
      const refreshToken = await prisma.refreshToken.create({
        data: {
          token: 'test-token-active',
          userId: user.id,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Valid for 30 days
        },
      });

      // Create an active, non-expired session
      const activeSession = await prisma.session.create({
        data: {
          userId: user.id,
          refreshTokenId: refreshToken.id,
          ipAddress: '127.0.0.1',
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Valid for 30 days
          isActive: true,
        },
      });

      // Run cleanup
      await sessionService.cleanupExpiredSessions();

      // Verify session still exists
      const session = await prisma.session.findUnique({
        where: { id: activeSession.id },
      });

      expect(session).not.toBeNull();
      expect(session.id).toBe(activeSession.id);

      // Cleanup test user
      await prisma.user.delete({ where: { id: user.id } });
    });
  });

  describe('cleanupExpiredRefreshTokens', () => {
    it('should delete expired refresh tokens', async () => {
      // Create a test user
      const user = await prisma.user.create({
        data: {
          email: `cleanup-token-expired-${Date.now()}@example.com`,
          password: 'hashedPassword',
          firstName: 'Cleanup',
          lastName: 'Test',
        },
      });

      // Create an expired refresh token
      const expiredToken = await prisma.refreshToken.create({
        data: {
          token: 'test-token-expired-refresh',
          userId: user.id,
          expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Expired 1 day ago
        },
      });

      // Run cleanup
      const deletedCount = await sessionService.cleanupExpiredRefreshTokens();

      // Verify token was deleted
      const token = await prisma.refreshToken.findUnique({
        where: { id: expiredToken.id },
      });

      expect(token).toBeNull();
      expect(deletedCount).toBeGreaterThanOrEqual(1);

      // Cleanup test user
      await prisma.user.delete({ where: { id: user.id } });
    });

    it('should delete revoked tokens older than REVOKED_REFRESH_TOKEN_CLEANUP_DAYS', async () => {
      // Create a test user
      const user = await prisma.user.create({
        data: {
          email: `cleanup-token-revoked-${Date.now()}@example.com`,
          password: 'hashedPassword',
          firstName: 'Cleanup',
          lastName: 'Test',
        },
      });

      // Create a revoked token older than cleanup threshold
      const oldDate = new Date(Date.now() - (REVOKED_REFRESH_TOKEN_CLEANUP_DAYS + 1) * 24 * 60 * 60 * 1000);
      const revokedToken = await prisma.refreshToken.create({
        data: {
          token: 'test-token-revoked-refresh',
          userId: user.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Not expired
          isRevoked: true,
          createdAt: oldDate,
        },
      });

      // Run cleanup
      const deletedCount = await sessionService.cleanupExpiredRefreshTokens();

      // Verify token was deleted
      const token = await prisma.refreshToken.findUnique({
        where: { id: revokedToken.id },
      });

      expect(token).toBeNull();
      expect(deletedCount).toBeGreaterThanOrEqual(1);

      // Cleanup test user
      await prisma.user.delete({ where: { id: user.id } });
    });

    it('should NOT delete active, non-expired tokens', async () => {
      // Create a test user
      const user = await prisma.user.create({
        data: {
          email: `cleanup-token-active-${Date.now()}@example.com`,
          password: 'hashedPassword',
          firstName: 'Cleanup',
          lastName: 'Test',
        },
      });

      // Create an active, non-expired token
      const activeToken = await prisma.refreshToken.create({
        data: {
          token: 'test-token-active-refresh',
          userId: user.id,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Valid for 30 days
          isRevoked: false,
        },
      });

      // Run cleanup
      await sessionService.cleanupExpiredRefreshTokens();

      // Verify token still exists
      const token = await prisma.refreshToken.findUnique({
        where: { id: activeToken.id },
      });

      expect(token).not.toBeNull();
      expect(token.id).toBe(activeToken.id);

      // Cleanup test user
      await prisma.user.delete({ where: { id: user.id } });
    });
  });
});
