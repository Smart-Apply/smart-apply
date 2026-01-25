import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionService } from '../subscription.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SubscriptionTier, SubscriptionStatus } from '../../generated/prisma/client';

describe('SubscriptionService', () => {
  let service: SubscriptionService;

  // Create typed mock functions
  const mockSubscriptionFindUnique = jest.fn();
  const mockSubscriptionCreate = jest.fn();
  const mockSubscriptionUpdate = jest.fn();
  const mockUsageCreate = jest.fn();
  const mockUsageUpdate = jest.fn();

  beforeEach(async () => {
    // Reset mocks before each test
    mockSubscriptionFindUnique.mockReset();
    mockSubscriptionCreate.mockReset();
    mockSubscriptionUpdate.mockReset();
    mockUsageCreate.mockReset();
    mockUsageUpdate.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionService,
        {
          provide: PrismaService,
          useValue: {
            subscription: {
              findUnique: mockSubscriptionFindUnique,
              create: mockSubscriptionCreate,
              update: mockSubscriptionUpdate,
            },
            subscriptionUsage: {
              create: mockUsageCreate,
              update: mockUsageUpdate,
            },
          },
        },
      ],
    }).compile();

    service = module.get<SubscriptionService>(SubscriptionService);
  });

  describe('getTierLimits', () => {
    it('should return FREE tier limits', () => {
      const limits = service.getTierLimits(SubscriptionTier.FREE);

      expect(limits.coverLettersPerMonth).toBe(3);
      expect(limits.resumesPerMonth).toBe(3);
      expect(limits.jobParsingPerMonth).toBe(10);
      expect(limits.interviewSessionsPerMonth).toBe(0);
      expect(limits.priority).toBe('low');
      expect(limits.features.interviewCoach).toBe(false);
      expect(limits.features.pdfExport).toBe(false);
    });

    it('should return PRO tier limits', () => {
      const limits = service.getTierLimits(SubscriptionTier.PRO);
      expect(limits.coverLettersPerMonth).toBe(-1); // Unlimited
      expect(limits.resumesPerMonth).toBe(-1); // Unlimited
      expect(limits.jobParsingPerMonth).toBe(-1); // Unlimited
      expect(limits.interviewSessionsPerMonth).toBe(0);
      expect(limits.priority).toBe('normal');
      expect(limits.features.pdfExport).toBe(true);
      expect(limits.features.atsOptimization).toBe(true);
      expect(limits.features.interviewCoach).toBe(false);
    });

    it('should return PREMIUM tier limits (all features)', () => {
      const limits = service.getTierLimits(SubscriptionTier.PREMIUM);
      expect(limits.coverLettersPerMonth).toBe(-1); // Unlimited
      expect(limits.resumesPerMonth).toBe(-1); // Unlimited
      expect(limits.jobParsingPerMonth).toBe(-1); // Unlimited
      expect(limits.interviewSessionsPerMonth).toBe(-1); // Unlimited
      expect(limits.priority).toBe('high');
      expect(limits.features.prioritySupport).toBe(true);
      expect(limits.features.interviewCoach).toBe(true);
      expect(limits.features.autoApplyAgent).toBe(true);
    });
  });

  describe('getUserTier', () => {
    it('should return tier for existing subscription', async () => {
      const mockSubscription = {
        id: 'sub-123',
        userId: 'user-123',
        tier: SubscriptionTier.PRO,
        status: SubscriptionStatus.ACTIVE,
        usage: {
          id: 'usage-123',
          applicationsUsed: 0,
          coverLettersGenerated: 0,
          resumesGenerated: 0,
          jobParsingUsed: 0,
          interviewSessionsUsed: 0,
          periodStart: new Date(),
          periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      };
      mockSubscriptionFindUnique.mockResolvedValue(mockSubscription);

      const tier = await service.getUserTier('user-123');

      expect(tier).toBe(SubscriptionTier.PRO);
    });

    it('should return FREE for inactive subscription', async () => {
      const mockSubscription = {
        id: 'sub-123',
        userId: 'user-123',
        tier: SubscriptionTier.PRO,
        status: SubscriptionStatus.CANCELED, // Inactive
        usage: null,
      };
      mockSubscriptionFindUnique.mockResolvedValue(mockSubscription);

      const tier = await service.getUserTier('user-123');

      expect(tier).toBe(SubscriptionTier.FREE);
    });

    it('should create FREE subscription for new user', async () => {
      mockSubscriptionFindUnique.mockResolvedValue(null);
      mockSubscriptionCreate.mockResolvedValue({
        id: 'sub-new',
        userId: 'user-123',
        tier: SubscriptionTier.FREE,
        status: SubscriptionStatus.ACTIVE,
        usage: {
          id: 'usage-new',
          applicationsUsed: 0,
          coverLettersGenerated: 0,
          resumesGenerated: 0,
          jobParsingUsed: 0,
          interviewSessionsUsed: 0,
          periodStart: new Date(),
          periodEnd: new Date(),
        },
      });

      const tier = await service.getUserTier('user-123');

      expect(tier).toBe(SubscriptionTier.FREE);
      expect(mockSubscriptionCreate).toHaveBeenCalled();
    });
  });

  describe('hasTier', () => {
    beforeEach(() => {
      mockSubscriptionFindUnique.mockResolvedValue({
        id: 'sub-123',
        userId: 'user-123',
        tier: SubscriptionTier.PRO,
        status: SubscriptionStatus.ACTIVE,
        usage: {
          id: 'usage-123',
          applicationsUsed: 0,
          coverLettersGenerated: 0,
          resumesGenerated: 0,
          jobParsingUsed: 0,
          interviewSessionsUsed: 0,
          periodStart: new Date(),
          periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
    });

    it('should return true when user has exact tier', async () => {
      const result = await service.hasTier('user-123', SubscriptionTier.PRO);
      expect(result).toBe(true);
    });

    it('should return true when user has higher tier', async () => {
      mockSubscriptionFindUnique.mockResolvedValue({
        id: 'sub-123',
        userId: 'user-123',
        tier: SubscriptionTier.PREMIUM,
        status: SubscriptionStatus.ACTIVE,
        usage: null,
      });

      const result = await service.hasTier('user-123', SubscriptionTier.PRO);
      expect(result).toBe(true);
    });

    it('should return false when user has lower tier', async () => {
      mockSubscriptionFindUnique.mockResolvedValue({
        id: 'sub-123',
        userId: 'user-123',
        tier: SubscriptionTier.FREE,
        status: SubscriptionStatus.ACTIVE,
        usage: null,
      });

      const result = await service.hasTier('user-123', SubscriptionTier.PRO);
      expect(result).toBe(false);
    });
  });

  describe('canPerformAction', () => {
    const createMockSubscription = (
      tier: SubscriptionTier,
      coverLettersGenerated: number,
      resumesGenerated: number,
      jobParsingUsed: number,
      interviewSessionsUsed: number,
    ) => ({
      id: 'sub-123',
      userId: 'user-123',
      tier,
      status: SubscriptionStatus.ACTIVE,
      usage: {
        id: 'usage-123',
        subscriptionId: 'sub-123',
        applicationsUsed: coverLettersGenerated + resumesGenerated,
        coverLettersGenerated,
        resumesGenerated,
        jobParsingUsed,
        interviewSessionsUsed,
        periodStart: new Date(),
        periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    describe('coverLetter action', () => {
      it('should allow FREE users when under limit', async () => {
        mockSubscriptionFindUnique.mockResolvedValue(
          createMockSubscription(SubscriptionTier.FREE, 1, 0, 0, 0),
        );

        const result = await service.canPerformAction('user-123', 'coverLetter');

        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(2); // 3 - 1 = 2
        expect(result.limit).toBe(3);
      });

      it('should deny FREE users when at limit', async () => {
        mockSubscriptionFindUnique.mockResolvedValue(
          createMockSubscription(SubscriptionTier.FREE, 3, 0, 0, 0),
        );

        const result = await service.canPerformAction('user-123', 'coverLetter');

        expect(result.allowed).toBe(false);
        expect(result.remaining).toBe(0);
        expect(result.reason).toContain('Limit');
      });

      it('should return unlimited for PRO users', async () => {
        mockSubscriptionFindUnique.mockResolvedValue(
          createMockSubscription(SubscriptionTier.PRO, 100, 0, 0, 0),
        );

        const result = await service.canPerformAction('user-123', 'coverLetter');

        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(-1);
        expect(result.limit).toBe(-1);
      });
    });

    describe('jobParsing action', () => {
      it('should allow FREE users when under limit', async () => {
        mockSubscriptionFindUnique.mockResolvedValue(
          createMockSubscription(SubscriptionTier.FREE, 0, 0, 5, 0),
        );

        const result = await service.canPerformAction('user-123', 'jobParsing');

        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(5); // 10 - 5 = 5
        expect(result.limit).toBe(10);
      });

      it('should deny FREE users when at limit', async () => {
        mockSubscriptionFindUnique.mockResolvedValue(
          createMockSubscription(SubscriptionTier.FREE, 0, 0, 10, 0),
        );

        const result = await service.canPerformAction('user-123', 'jobParsing');

        expect(result.allowed).toBe(false);
        expect(result.remaining).toBe(0);
      });
    });

    describe('interview action', () => {
      it('should deny FREE users (limit = 0)', async () => {
        mockSubscriptionFindUnique.mockResolvedValue(
          createMockSubscription(SubscriptionTier.FREE, 0, 0, 0, 0),
        );

        const result = await service.canPerformAction('user-123', 'interview');

        expect(result.allowed).toBe(false);
        expect(result.limit).toBe(0);
      });

      it('should deny PRO users (limit = 0)', async () => {
        mockSubscriptionFindUnique.mockResolvedValue(
          createMockSubscription(SubscriptionTier.PRO, 0, 0, 0, 0),
        );

        const result = await service.canPerformAction('user-123', 'interview');

        expect(result.allowed).toBe(false);
        expect(result.limit).toBe(0);
      });

      it('should allow PREMIUM users (unlimited)', async () => {
        mockSubscriptionFindUnique.mockResolvedValue(
          createMockSubscription(SubscriptionTier.PREMIUM, 0, 0, 0, 10),
        );

        const result = await service.canPerformAction('user-123', 'interview');

        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(-1); // Unlimited
      });
    });
  });

  describe('recordUsage', () => {
    const mockSubscription = {
      id: 'sub-123',
      userId: 'user-123',
      tier: SubscriptionTier.FREE,
      status: SubscriptionStatus.ACTIVE,
      usage: {
        id: 'usage-123',
        subscriptionId: 'sub-123',
        applicationsUsed: 2,
        coverLettersGenerated: 1,
        resumesGenerated: 1,
        jobParsingUsed: 3,
        interviewSessionsUsed: 0,
        periodStart: new Date(),
        periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };

    it('should increment coverLetter usage', async () => {
      mockSubscriptionFindUnique.mockResolvedValue(mockSubscription);
      mockUsageUpdate.mockResolvedValue({
        ...mockSubscription.usage,
        coverLettersGenerated: 2,
        applicationsUsed: 3,
      });

      await service.recordUsage('user-123', 'coverLetter');

      expect(mockUsageUpdate).toHaveBeenCalledWith({
        where: { id: 'usage-123' },
        data: {
          coverLettersGenerated: { increment: 1 },
          applicationsUsed: { increment: 1 },
        },
      });
    });

    it('should increment resume usage', async () => {
      mockSubscriptionFindUnique.mockResolvedValue(mockSubscription);
      mockUsageUpdate.mockResolvedValue({
        ...mockSubscription.usage,
        resumesGenerated: 2,
        applicationsUsed: 3,
      });

      await service.recordUsage('user-123', 'resume');

      expect(mockUsageUpdate).toHaveBeenCalledWith({
        where: { id: 'usage-123' },
        data: {
          resumesGenerated: { increment: 1 },
          applicationsUsed: { increment: 1 },
        },
      });
    });

    it('should increment jobParsing usage', async () => {
      mockSubscriptionFindUnique.mockResolvedValue(mockSubscription);
      mockUsageUpdate.mockResolvedValue({
        ...mockSubscription.usage,
        jobParsingUsed: 4,
      });

      await service.recordUsage('user-123', 'jobParsing');

      expect(mockUsageUpdate).toHaveBeenCalledWith({
        where: { id: 'usage-123' },
        data: {
          jobParsingUsed: { increment: 1 },
        },
      });
    });

    it('should increment interview usage', async () => {
      mockSubscriptionFindUnique.mockResolvedValue(mockSubscription);
      mockUsageUpdate.mockResolvedValue({
        ...mockSubscription.usage,
        interviewSessionsUsed: 1,
      });

      await service.recordUsage('user-123', 'interview');

      expect(mockUsageUpdate).toHaveBeenCalledWith({
        where: { id: 'usage-123' },
        data: { interviewSessionsUsed: { increment: 1 } },
      });
    });
  });

  describe('getUsageStats', () => {
    it('should return complete usage statistics', async () => {
      mockSubscriptionFindUnique.mockResolvedValue({
        id: 'sub-123',
        userId: 'user-123',
        tier: SubscriptionTier.PRO,
        status: SubscriptionStatus.ACTIVE,
        usage: {
          id: 'usage-123',
          subscriptionId: 'sub-123',
          applicationsUsed: 10,
          coverLettersGenerated: 5,
          resumesGenerated: 5,
          jobParsingUsed: 20,
          interviewSessionsUsed: 0,
          periodStart: new Date('2026-01-01'),
          periodEnd: new Date('2026-02-01'),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const stats = await service.getUsageStats('user-123');

      expect(stats.tier).toBe(SubscriptionTier.PRO);
      expect(stats.coverLetters.used).toBe(5);
      expect(stats.coverLetters.limit).toBe(-1); // Unlimited for PRO
      expect(stats.resumes.used).toBe(5);
      expect(stats.resumes.limit).toBe(-1); // Unlimited for PRO
      expect(stats.jobParsing.used).toBe(20);
      expect(stats.jobParsing.limit).toBe(-1); // Unlimited for PRO
      expect(stats.features.pdfExport).toBe(true);
      expect(stats.features.atsOptimization).toBe(true);
    });
  });

  describe('hasFeature', () => {
    it('should return false for FREE users checking pdfExport', async () => {
      mockSubscriptionFindUnique.mockResolvedValue({
        id: 'sub-123',
        userId: 'user-123',
        tier: SubscriptionTier.FREE,
        status: SubscriptionStatus.ACTIVE,
        usage: null,
      });

      const result = await service.hasFeature('user-123', 'pdfExport');
      expect(result).toBe(false);
    });

    it('should return true for PRO users checking pdfExport', async () => {
      mockSubscriptionFindUnique.mockResolvedValue({
        id: 'sub-123',
        userId: 'user-123',
        tier: SubscriptionTier.PRO,
        status: SubscriptionStatus.ACTIVE,
        usage: null,
      });

      const result = await service.hasFeature('user-123', 'pdfExport');
      expect(result).toBe(true);
    });

    it('should return false for PRO users checking interviewCoach', async () => {
      mockSubscriptionFindUnique.mockResolvedValue({
        id: 'sub-123',
        userId: 'user-123',
        tier: SubscriptionTier.PRO,
        status: SubscriptionStatus.ACTIVE,
        usage: null,
      });

      const result = await service.hasFeature('user-123', 'interviewCoach');
      expect(result).toBe(false);
    });

    it('should return true for PREMIUM users checking interviewCoach', async () => {
      mockSubscriptionFindUnique.mockResolvedValue({
        id: 'sub-123',
        userId: 'user-123',
        tier: SubscriptionTier.PREMIUM,
        status: SubscriptionStatus.ACTIVE,
        usage: null,
      });

      const result = await service.hasFeature('user-123', 'interviewCoach');
      expect(result).toBe(true);
    });

    it('should return true for PREMIUM users checking prioritySupport', async () => {
      mockSubscriptionFindUnique.mockResolvedValue({
        id: 'sub-123',
        userId: 'user-123',
        tier: SubscriptionTier.PREMIUM,
        status: SubscriptionStatus.ACTIVE,
        usage: null,
      });

      const result = await service.hasFeature('user-123', 'prioritySupport');
      expect(result).toBe(true);
    });
  });

  describe('getQueuePriority', () => {
    it('should return low for FREE tier', async () => {
      mockSubscriptionFindUnique.mockResolvedValue({
        id: 'sub-123',
        userId: 'user-123',
        tier: SubscriptionTier.FREE,
        status: SubscriptionStatus.ACTIVE,
        usage: null,
      });

      const priority = await service.getQueuePriority('user-123');
      expect(priority).toBe('low');
    });

    it('should return normal for PRO tier', async () => {
      mockSubscriptionFindUnique.mockResolvedValue({
        id: 'sub-123',
        userId: 'user-123',
        tier: SubscriptionTier.PRO,
        status: SubscriptionStatus.ACTIVE,
        usage: null,
      });

      const priority = await service.getQueuePriority('user-123');
      expect(priority).toBe('normal');
    });

    it('should return high for PREMIUM tier', async () => {
      mockSubscriptionFindUnique.mockResolvedValue({
        id: 'sub-123',
        userId: 'user-123',
        tier: SubscriptionTier.PREMIUM,
        status: SubscriptionStatus.ACTIVE,
        usage: null,
      });

      const priority = await service.getQueuePriority('user-123');
      expect(priority).toBe('high');
    });
  });
});
