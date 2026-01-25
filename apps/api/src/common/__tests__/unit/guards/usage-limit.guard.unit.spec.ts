import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UsageLimitGuard } from '../../../guards/usage-limit.guard';
import {
  SubscriptionService,
  CanPerformActionResult,
} from '../../../../subscription/subscription.service';

describe('UsageLimitGuard', () => {
  let guard: UsageLimitGuard;
  let reflector: Reflector;
  let subscriptionService: jest.Mocked<SubscriptionService>;

  beforeEach(() => {
    reflector = new Reflector();
    subscriptionService = {
      canPerformAction: jest.fn(),
    } as unknown as jest.Mocked<SubscriptionService>;

    guard = new UsageLimitGuard(reflector, subscriptionService);
  });

  const createMockExecutionContext = (user?: { id: string }): ExecutionContext => {
    const mockRequest: Record<string, unknown> = { user };
    return {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
    } as unknown as ExecutionContext;
  };

  describe('canActivate', () => {
    describe('when no usage action is specified', () => {
      it('should allow access (no usage check needed)', async () => {
        jest.spyOn(reflector, 'get').mockReturnValue(undefined);
        const context = createMockExecutionContext({ id: 'user-123' });

        const result = await guard.canActivate(context);

        expect(result).toBe(true);
        expect(subscriptionService.canPerformAction).not.toHaveBeenCalled();
      });
    });

    describe('when usage action is specified', () => {
      beforeEach(() => {
        jest.spyOn(reflector, 'get').mockReturnValue('application');
      });

      it('should throw UnauthorizedException when user is not authenticated', async () => {
        const context = createMockExecutionContext(undefined);

        await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
        expect(subscriptionService.canPerformAction).not.toHaveBeenCalled();
      });

      it('should allow access when user has remaining quota', async () => {
        const actionResult: CanPerformActionResult = {
          allowed: true,
          remaining: 4,
          limit: 5,
        };
        subscriptionService.canPerformAction.mockResolvedValue(actionResult);

        const context = createMockExecutionContext({ id: 'user-123' });
        const request = context.switchToHttp().getRequest();

        const result = await guard.canActivate(context);

        expect(result).toBe(true);
        expect(subscriptionService.canPerformAction).toHaveBeenCalledWith(
          'user-123',
          'application',
        );
        expect(request.usageRemaining).toBe(4);
        expect(request.usageLimit).toBe(5);
        expect(request.usageAction).toBe('application');
      });

      it('should throw ForbiddenException when usage limit exceeded', async () => {
        const actionResult: CanPerformActionResult = {
          allowed: false,
          remaining: 0,
          limit: 5,
          reason: 'Du hast dein monatliches Limit von 5 Bewerbungen erreicht. Upgrade für mehr.',
        };
        subscriptionService.canPerformAction.mockResolvedValue(actionResult);

        const context = createMockExecutionContext({ id: 'user-123' });

        await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
        expect(subscriptionService.canPerformAction).toHaveBeenCalledWith(
          'user-123',
          'application',
        );
      });

      it('should include usage info in ForbiddenException', async () => {
        const actionResult: CanPerformActionResult = {
          allowed: false,
          remaining: 0,
          limit: 5,
          reason: 'Limit erreicht',
        };
        subscriptionService.canPerformAction.mockResolvedValue(actionResult);

        const context = createMockExecutionContext({ id: 'user-123' });

        try {
          await guard.canActivate(context);
          fail('Expected ForbiddenException');
        } catch (error) {
          expect(error).toBeInstanceOf(ForbiddenException);
          const response = (error as ForbiddenException).getResponse() as Record<string, unknown>;
          expect(response.message).toBe('Limit erreicht');
          expect(response.remaining).toBe(0);
          expect(response.limit).toBe(5);
          expect(response.upgradeUrl).toBe('/pricing');
        }
      });
    });

    describe('unlimited usage (PREMIUM_PLUS)', () => {
      it('should allow access and set unlimited in request', async () => {
        jest.spyOn(reflector, 'get').mockReturnValue('interview');
        const actionResult: CanPerformActionResult = {
          allowed: true,
          remaining: -1, // Unlimited
          limit: -1,
        };
        subscriptionService.canPerformAction.mockResolvedValue(actionResult);

        const context = createMockExecutionContext({ id: 'user-123' });
        const request = context.switchToHttp().getRequest();

        const result = await guard.canActivate(context);

        expect(result).toBe(true);
        expect(request.usageRemaining).toBe(-1);
        expect(request.usageLimit).toBe(-1);
      });
    });

    describe('different actions', () => {
      it('should check application usage', async () => {
        jest.spyOn(reflector, 'get').mockReturnValue('application');
        subscriptionService.canPerformAction.mockResolvedValue({
          allowed: true,
          remaining: 3,
          limit: 5,
        });

        const context = createMockExecutionContext({ id: 'user-123' });

        await guard.canActivate(context);

        expect(subscriptionService.canPerformAction).toHaveBeenCalledWith(
          'user-123',
          'application',
        );
      });

      it('should check interview usage', async () => {
        jest.spyOn(reflector, 'get').mockReturnValue('interview');
        subscriptionService.canPerformAction.mockResolvedValue({
          allowed: true,
          remaining: 10,
          limit: 20,
        });

        const context = createMockExecutionContext({ id: 'user-123' });

        await guard.canActivate(context);

        expect(subscriptionService.canPerformAction).toHaveBeenCalledWith('user-123', 'interview');
      });
    });
  });
});
