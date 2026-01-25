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

      expect(limits.applicationsPerMonth).toBe(5);
      expect(limits.interviewSessionsPerMonth).toBe(0);
      expect(limits.priority).toBe('low');
      expect(limits.features.interviewCoach).toBe(false);
    });

    it('should return PREMIUM tier limits', () => {
      const limits = service.getTierLimits(SubscriptionTier.PREMIUM);
      expect(limits.applicationsPerMonth).toBe(50);
      expect(limits.interviewSessionsPerMonth).toBe(20);
      expect(limits.priority).toBe('normal');
      expect(limits.features.interviewCoach).toBe(true);
    });

    it('should return PREMIUM_PLUS tier limits (unlimited)', () => {
      const limits = service.getTierLimits(SubscriptionTier.PREMIUM_PLUS);
      expect(limits.applicationsPerMonth).toBe(-1); // Unlimited
      expect(limits.interviewSessionsPerMonth).toBe(-1);
      expect(limits.priority).toBe('high');
      expect(limits.features.prioritySupport).toBe(true);
    });
  });

  describe('getUserTier', () => {
    it('should return tier for existing subscription', async () => {
      const mockSubscription = {
        id: 'sub-123',
        userId: 'user-123',
        tier: SubscriptionTier.PREMIUM,
        status: SubscriptionStatus.ACTIVE,
        usage: {
          id: 'usage-123',
          applicationsUsed: 0,
          interviewSessionsUsed: 0,
          periodStart: new Date(),
          periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      };
      mockSubscriptionFindUnique.mockResolvedValue(mockSubscription);

      const tier = await service.getUserTier('user-123');

      expect(tier).toBe(SubscriptionTier.PREMIUM);
    });

    it('should return FREE for inactive subscription', async () => {
      const mockSubscription = {
        id: 'sub-123',
        userId: 'user-123',
        tier: SubscriptionTier.PREMIUM,
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
        tier: SubscriptionTier.PREMIUM,
        status: SubscriptionStatus.ACTIVE,
        usage: {
          id: 'usage-123',
          applicationsUsed: 0,
          interviewSessionsUsed: 0,
          periodStart: new Date(),
          periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
    });

    it('should return true when user has exact tier', async () => {
      const result = await service.hasTier('user-123', SubscriptionTier.PREMIUM);
      expect(result).toBe(true);
    });

    it('should return true when user has higher tier', async () => {
      mockSubscriptionFindUnique.mockResolvedValue({
        id: 'sub-123',
        userId: 'user-123',
        tier: SubscriptionTier.PREMIUM_PLUS,
        status: SubscriptionStatus.ACTIVE,
        usage: null,
      });

      const result = await service.hasTier('user-123', SubscriptionTier.PREMIUM);
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

      const result = await service.hasTier('user-123', SubscriptionTier.PREMIUM);
      expect(result).toBe(false);
    });
  });

  describe('canPerformAction', () => {
    const createMockSubscription = (
      tier: SubscriptionTier,
      applicationsUsed: number,
      interviewSessionsUsed: number,
    ) => ({
      id: 'sub-123',
      userId: 'user-123',
      tier,
      status: SubscriptionStatus.ACTIVE,
      usage: {
        id: 'usage-123',
        subscriptionId: 'sub-123',
        applicationsUsed,
        interviewSessionsUsed,
        periodStart: new Date(),
        periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    describe('application action', () => {
      it('should allow when under limit', async () => {
        mockSubscriptionFindUnique.mockResolvedValue(
          createMockSubscription(SubscriptionTier.FREE, 2, 0),
        );

        const result = await service.canPerformAction('user-123', 'application');

        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(3); // 5 - 2 = 3
        expect(result.limit).toBe(5);
      });

      it('should deny when at limit', async () => {
        mockSubscriptionFindUnique.mockResolvedValue(
          createMockSubscription(SubscriptionTier.FREE, 5, 0),
        );

        const result = await service.canPerformAction('user-123', 'application');

        expect(result.allowed).toBe(false);
        expect(result.remaining).toBe(0);
        expect(result.reason).toContain('Limit');
      });

      it('should return unlimited for PREMIUM_PLUS', async () => {
        mockSubscriptionFindUnique.mockResolvedValue(
          createMockSubscription(SubscriptionTier.PREMIUM_PLUS, 100, 0),
        );

        const result = await service.canPerformAction('user-123', 'application');

        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(-1);
        expect(result.limit).toBe(-1);
      });
    });

    describe('interview action', () => {
      it('should deny FREE users (limit = 0)', async () => {
        mockSubscriptionFindUnique.mockResolvedValue(
          createMockSubscription(SubscriptionTier.FREE, 0, 0),
        );

        const result = await service.canPerformAction('user-123', 'interview');

        expect(result.allowed).toBe(false);
        expect(result.limit).toBe(0);
      });

      it('should allow PREMIUM users under limit', async () => {
        mockSubscriptionFindUnique.mockResolvedValue(
          createMockSubscription(SubscriptionTier.PREMIUM, 0, 5),
        );

        const result = await service.canPerformAction('user-123', 'interview');

        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(15); // 20 - 5 = 15
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
        interviewSessionsUsed: 0,
        periodStart: new Date(),
        periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };

    it('should increment application usage', async () => {
      mockSubscriptionFindUnique.mockResolvedValue(mockSubscription);
      mockUsageUpdate.mockResolvedValue({
        ...mockSubscription.usage,
        applicationsUsed: 3,
      });

      await service.recordUsage('user-123', 'application');

      expect(mockUsageUpdate).toHaveBeenCalledWith({
        where: { id: 'usage-123' },
        data: { applicationsUsed: { increment: 1 } },
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
        tier: SubscriptionTier.PREMIUM,
        status: SubscriptionStatus.ACTIVE,
        usage: {
          id: 'usage-123',
          subscriptionId: 'sub-123',
          applicationsUsed: 10,
          interviewSessionsUsed: 5,
          periodStart: new Date('2026-01-01'),
          periodEnd: new Date('2026-02-01'),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const stats = await service.getUsageStats('user-123');

      expect(stats.tier).toBe(SubscriptionTier.PREMIUM);
      expect(stats.applications.used).toBe(10);
      expect(stats.applications.limit).toBe(50);
      expect(stats.applications.remaining).toBe(40);
      expect(stats.interviewSessions.used).toBe(5);
      expect(stats.interviewSessions.limit).toBe(20);
      expect(stats.interviewSessions.remaining).toBe(15);
      expect(stats.features.interviewCoach).toBe(true);
    });
  });

  describe('hasFeature', () => {
    it('should return false for FREE users checking interview coach', async () => {
      mockSubscriptionFindUnique.mockResolvedValue({
        id: 'sub-123',
        userId: 'user-123',
        tier: SubscriptionTier.FREE,
        status: SubscriptionStatus.ACTIVE,
        usage: null,
      });

      const result = await service.hasFeature('user-123', 'interviewCoach');
      expect(result).toBe(false);
    });

    it('should return true for PREMIUM users checking interview coach', async () => {
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

    it('should return true for PREMIUM_PLUS users checking priority support', async () => {
      mockSubscriptionFindUnique.mockResolvedValue({
        id: 'sub-123',
        userId: 'user-123',
        tier: SubscriptionTier.PREMIUM_PLUS,
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

    it('should return normal for PREMIUM tier', async () => {
      mockSubscriptionFindUnique.mockResolvedValue({
        id: 'sub-123',
        userId: 'user-123',
        tier: SubscriptionTier.PREMIUM,
        status: SubscriptionStatus.ACTIVE,
        usage: null,
      });

      const priority = await service.getQueuePriority('user-123');
      expect(priority).toBe('normal');
    });

    it('should return high for PREMIUM_PLUS tier', async () => {
      mockSubscriptionFindUnique.mockResolvedValue({
        id: 'sub-123',
        userId: 'user-123',
        tier: SubscriptionTier.PREMIUM_PLUS,
        status: SubscriptionStatus.ACTIVE,
        usage: null,
      });

      const priority = await service.getQueuePriority('user-123');
      expect(priority).toBe('high');
    });
  });
});
