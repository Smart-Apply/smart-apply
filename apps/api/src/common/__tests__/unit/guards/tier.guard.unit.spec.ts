import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TierGuard } from '../../../guards/tier.guard';
import { SubscriptionService } from '../../../../subscription/subscription.service';
import { SubscriptionTier } from '../../../../generated/prisma/client';

describe('TierGuard', () => {
  let guard: TierGuard;
  let reflector: Reflector;
  let subscriptionService: jest.Mocked<SubscriptionService>;

  beforeEach(() => {
    reflector = new Reflector();
    subscriptionService = {
      hasTier: jest.fn(),
      getUserTier: jest.fn(),
    } as unknown as jest.Mocked<SubscriptionService>;

    guard = new TierGuard(reflector, subscriptionService);
  });

  const createMockExecutionContext = (user?: { id: string }): ExecutionContext => {
    const mockRequest = { user };
    return {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
    } as unknown as ExecutionContext;
  };

  describe('canActivate', () => {
    describe('when no tier is required', () => {
      it('should allow access (public endpoint)', async () => {
        jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
        const context = createMockExecutionContext({ id: 'user-123' });

        const result = await guard.canActivate(context);

        expect(result).toBe(true);
        expect(subscriptionService.hasTier).not.toHaveBeenCalled();
      });
    });

    describe('when tier is required', () => {
      beforeEach(() => {
        jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(SubscriptionTier.PREMIUM);
      });

      it('should throw UnauthorizedException when user is not authenticated', async () => {
        const context = createMockExecutionContext(undefined);

        await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
        expect(subscriptionService.hasTier).not.toHaveBeenCalled();
      });

      it('should allow access when user has required tier', async () => {
        subscriptionService.hasTier.mockResolvedValue(true);
        const context = createMockExecutionContext({ id: 'user-123' });

        const result = await guard.canActivate(context);

        expect(result).toBe(true);
        expect(subscriptionService.hasTier).toHaveBeenCalledWith(
          'user-123',
          SubscriptionTier.PREMIUM,
        );
      });

      it('should throw ForbiddenException when user lacks required tier', async () => {
        subscriptionService.hasTier.mockResolvedValue(false);
        subscriptionService.getUserTier.mockResolvedValue(SubscriptionTier.FREE);
        const context = createMockExecutionContext({ id: 'user-123' });

        await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
        expect(subscriptionService.hasTier).toHaveBeenCalledWith(
          'user-123',
          SubscriptionTier.PREMIUM,
        );
        expect(subscriptionService.getUserTier).toHaveBeenCalledWith('user-123');
      });

      it('should include upgrade info in ForbiddenException', async () => {
        subscriptionService.hasTier.mockResolvedValue(false);
        subscriptionService.getUserTier.mockResolvedValue(SubscriptionTier.FREE);
        const context = createMockExecutionContext({ id: 'user-123' });

        try {
          await guard.canActivate(context);
          fail('Expected ForbiddenException');
        } catch (error) {
          expect(error).toBeInstanceOf(ForbiddenException);
          const response = (error as ForbiddenException).getResponse() as Record<string, unknown>;
          expect(response.requiredTier).toBe(SubscriptionTier.PREMIUM);
          expect(response.currentTier).toBe(SubscriptionTier.FREE);
          expect(response.upgradeUrl).toBe('/pricing');
        }
      });
    });

    describe('tier hierarchy', () => {
      it('should allow PREMIUM_PLUS user to access PREMIUM endpoint', async () => {
        jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(SubscriptionTier.PREMIUM);
        subscriptionService.hasTier.mockResolvedValue(true); // PREMIUM_PLUS >= PREMIUM
        const context = createMockExecutionContext({ id: 'user-123' });

        const result = await guard.canActivate(context);

        expect(result).toBe(true);
      });

      it('should deny FREE user access to PREMIUM endpoint', async () => {
        jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(SubscriptionTier.PREMIUM);
        subscriptionService.hasTier.mockResolvedValue(false);
        subscriptionService.getUserTier.mockResolvedValue(SubscriptionTier.FREE);
        const context = createMockExecutionContext({ id: 'user-123' });

        await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      });
    });
  });
});
