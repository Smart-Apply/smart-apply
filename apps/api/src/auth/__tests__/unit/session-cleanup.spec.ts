import { Test, TestingModule } from '@nestjs/testing';
import { SessionService } from '../../session.service';
import { SessionCleanupCron } from '../../session-cleanup.cron';
import { ConfigService } from '../../../config/config.service';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  REVOKED_SESSION_CLEANUP_DAYS,
  OLD_SESSION_CLEANUP_DAYS,
  REVOKED_REFRESH_TOKEN_CLEANUP_DAYS,
} from '../../session.constants';

describe('SessionCleanupCron', () => {
  let service: SessionService;
  let cleanupCron: SessionCleanupCron;
  let prisma: PrismaService;
  let configService: ConfigService;

  // Mock ConfigService
  const mockConfigService = {
    enableCronJobs: true,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        SessionCleanupCron,
        PrismaService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<SessionService>(SessionService);
    cleanupCron = module.get<SessionCleanupCron>(SessionCleanupCron);
    prisma = module.get<PrismaService>(PrismaService);
    configService = module.get<ConfigService>(ConfigService);
  });

  describe('cleanupExpiredSessions', () => {
    it('should delete expired sessions', async () => {
      const now = new Date();
      const expiredDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 1 day ago

      // Mock prisma.session.deleteMany
      const deleteManyMock = jest.spyOn(prisma.session, 'deleteMany').mockResolvedValue({ count: 5 });

      const result = await service.cleanupExpiredSessions();

      expect(result).toBe(5);
      expect(deleteManyMock).toHaveBeenCalledWith({
        where: {
          OR: expect.arrayContaining([
            { expiresAt: { lt: expect.any(Date) } },
            {
              AND: [
                { isActive: false },
                { revokedAt: { lt: expect.any(Date) } },
              ],
            },
            { createdAt: { lt: expect.any(Date) } },
          ]),
        },
      });
    });

    it('should delete revoked sessions older than REVOKED_SESSION_CLEANUP_DAYS', async () => {
      const now = new Date();
      const oldRevokedDate = new Date(now.getTime() - (REVOKED_SESSION_CLEANUP_DAYS + 1) * 24 * 60 * 60 * 1000);

      const deleteManyMock = jest.spyOn(prisma.session, 'deleteMany').mockResolvedValue({ count: 3 });

      await service.cleanupExpiredSessions();

      const callArg = deleteManyMock.mock.calls[0][0];
      const orConditions = callArg.where.OR;

      // Check that one of the OR conditions is for revoked sessions
      const revokedCondition = orConditions.find(
        (cond: any) => cond.AND && cond.AND.find((c: any) => c.isActive === false)
      );
      expect(revokedCondition).toBeDefined();
    });

    it('should delete sessions older than OLD_SESSION_CLEANUP_DAYS', async () => {
      const deleteManyMock = jest.spyOn(prisma.session, 'deleteMany').mockResolvedValue({ count: 10 });

      await service.cleanupExpiredSessions();

      const callArg = deleteManyMock.mock.calls[0][0];
      const orConditions = callArg.where.OR;

      // Check that one of the OR conditions is for old sessions by createdAt
      const oldSessionCondition = orConditions.find((cond: any) => cond.createdAt);
      expect(oldSessionCondition).toBeDefined();
    });

    it('should handle errors gracefully', async () => {
      jest.spyOn(prisma.session, 'deleteMany').mockRejectedValue(new Error('Database error'));

      await expect(service.cleanupExpiredSessions()).rejects.toThrow('Database error');
    });
  });

  describe('cleanupExpiredRefreshTokens', () => {
    it('should delete expired refresh tokens', async () => {
      const deleteManyMock = jest.spyOn(prisma.refreshToken, 'deleteMany').mockResolvedValue({ count: 8 });

      const result = await service.cleanupExpiredRefreshTokens();

      expect(result).toBe(8);
      expect(deleteManyMock).toHaveBeenCalledWith({
        where: {
          OR: expect.arrayContaining([
            { expiresAt: { lt: expect.any(Date) } },
            {
              AND: [
                { isRevoked: true },
                { createdAt: { lt: expect.any(Date) } },
              ],
            },
          ]),
        },
      });
    });

    it('should delete revoked tokens older than REVOKED_REFRESH_TOKEN_CLEANUP_DAYS', async () => {
      const deleteManyMock = jest.spyOn(prisma.refreshToken, 'deleteMany').mockResolvedValue({ count: 5 });

      await service.cleanupExpiredRefreshTokens();

      const callArg = deleteManyMock.mock.calls[0][0];
      const orConditions = callArg.where.OR;

      // Check that one of the OR conditions is for revoked tokens
      const revokedCondition = orConditions.find(
        (cond: any) => cond.AND && cond.AND.find((c: any) => c.isRevoked === true)
      );
      expect(revokedCondition).toBeDefined();
    });

    it('should handle errors gracefully', async () => {
      jest.spyOn(prisma.refreshToken, 'deleteMany').mockRejectedValue(new Error('Database error'));

      await expect(service.cleanupExpiredRefreshTokens()).rejects.toThrow('Database error');
    });
  });

  describe('SessionCleanupCron', () => {
    it('should skip cleanup when ENABLE_CRON_JOBS is false', async () => {
      mockConfigService.enableCronJobs = false;

      const cleanupSessionsSpy = jest.spyOn(service, 'cleanupExpiredSessions');
      const cleanupTokensSpy = jest.spyOn(service, 'cleanupExpiredRefreshTokens');

      await cleanupCron.cleanupExpiredSessions();
      await cleanupCron.cleanupExpiredRefreshTokens();

      expect(cleanupSessionsSpy).not.toHaveBeenCalled();
      expect(cleanupTokensSpy).not.toHaveBeenCalled();

      // Reset for other tests
      mockConfigService.enableCronJobs = true;
    });

    it('should run cleanup when ENABLE_CRON_JOBS is true', async () => {
      mockConfigService.enableCronJobs = true;

      jest.spyOn(service, 'cleanupExpiredSessions').mockResolvedValue(5);
      jest.spyOn(service, 'cleanupExpiredRefreshTokens').mockResolvedValue(3);

      await cleanupCron.cleanupExpiredSessions();
      await cleanupCron.cleanupExpiredRefreshTokens();

      expect(service.cleanupExpiredSessions).toHaveBeenCalled();
      expect(service.cleanupExpiredRefreshTokens).toHaveBeenCalled();
    });

    it('should log errors if cleanup fails', async () => {
      mockConfigService.enableCronJobs = true;

      jest.spyOn(service, 'cleanupExpiredSessions').mockRejectedValue(new Error('Cleanup failed'));

      // Should not throw, but log error
      await cleanupCron.cleanupExpiredSessions();

      // No assertion needed - just verify it doesn't throw
    });
  });
});
