import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CustomThrottlerGuard } from './custom-throttler.guard';
import { THROTTLER_NAME_KEY } from '../decorators/throttle.decorator';

describe('CustomThrottlerGuard', () => {
  let guard: CustomThrottlerGuard;
  let reflector: Reflector;
  let mockStorageService: any;
  let mockOptions: any;

  beforeEach(() => {
    mockStorageService = {
      get: jest.fn().mockResolvedValue({ totalHits: 1, timeToExpire: 900000 }),
      increment: jest.fn().mockResolvedValue({ totalHits: 1, timeToExpire: 900000 }),
    };

    mockOptions = {
      throttlers: [
        { name: 'default', ttl: 900000, limit: 100 },
        { name: 'auth', ttl: 900000, limit: 5 },
      ],
    };

    reflector = new Reflector();
    guard = new CustomThrottlerGuard(mockOptions, mockStorageService, reflector);
  });

  describe('getThrottlers', () => {
    it('should return auth throttler when UseThrottler("auth") is applied', async () => {
      const mockContext = createMockExecutionContext();
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('auth');

      const throttlers = await guard['getThrottlers'](mockContext);

      expect(throttlers).toHaveLength(1);
      expect(throttlers[0].name).toBe('auth');
      expect(throttlers[0].limit).toBe(5);
    });

    it('should return default throttler when no decorator is applied', async () => {
      const mockContext = createMockExecutionContext();
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

      const throttlers = await guard['getThrottlers'](mockContext);

      expect(throttlers).toHaveLength(1);
      expect(throttlers[0].name).toBe('default');
      expect(throttlers[0].limit).toBe(100);
    });
  });

  describe('getTracker', () => {
    it('should return user ID for authenticated requests', async () => {
      const mockRequest = {
        user: { userId: 'user-123' },
        ip: '192.168.1.1',
      };

      const tracker = await guard['getTracker'](mockRequest);

      expect(tracker).toBe('user:user-123');
    });

    it('should return IP address for public requests', async () => {
      const mockRequest = {
        ip: '192.168.1.1',
      };

      const tracker = await guard['getTracker'](mockRequest);

      expect(tracker).toBe('192.168.1.1');
    });

    it('should return unknown when no IP or user', async () => {
      const mockRequest = {};

      const tracker = await guard['getTracker'](mockRequest);

      expect(tracker).toBe('unknown');
    });
  });

  describe('generateKey', () => {
    it('should generate a unique key with throttler name, route, and tracker', () => {
      const mockRequest = {
        method: 'POST',
        route: { path: '/auth/login' },
      };
      const mockContext = createMockExecutionContextWithRequest(mockRequest);

      const key = guard['generateKey'](mockContext, '192.168.1.1', 'auth');

      expect(key).toBe('auth:POST-/auth/login:192.168.1.1');
    });

    it('should use URL when route.path is not available', () => {
      const mockRequest = {
        method: 'POST',
        url: '/api/v1/auth/login',
      };
      const mockContext = createMockExecutionContextWithRequest(mockRequest);

      const key = guard['generateKey'](mockContext, '192.168.1.1', 'auth');

      expect(key).toBe('auth:POST-/api/v1/auth/login:192.168.1.1');
    });
  });

  function createMockExecutionContext(): ExecutionContext {
    const mockRequest = {
      ip: '192.168.1.1',
      method: 'POST',
      route: { path: '/test' },
      url: '/test',
    };

    const mockResponse = {
      setHeader: jest.fn(),
    };

    return {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
        getResponse: jest.fn().mockReturnValue(mockResponse),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as any;
  }

  function createMockExecutionContextWithRequest(request: any): ExecutionContext {
    const mockResponse = {
      setHeader: jest.fn(),
    };

    return {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(request),
        getResponse: jest.fn().mockReturnValue(mockResponse),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as any;
  }
});
