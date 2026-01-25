import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { UsageInterceptor } from '../../../interceptors/usage.interceptor';

describe('UsageInterceptor', () => {
  let interceptor: UsageInterceptor;
  let mockResponse: { setHeader: jest.Mock };
  let mockRequest: Record<string, unknown>;
  let mockCallHandler: CallHandler;
  let mockExecutionContext: ExecutionContext;

  beforeEach(() => {
    interceptor = new UsageInterceptor();
    mockResponse = {
      setHeader: jest.fn(),
    };
    mockRequest = {};
    mockCallHandler = {
      handle: jest.fn().mockReturnValue(of({ success: true })),
    };
    mockExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    } as unknown as ExecutionContext;
  });

  describe('intercept', () => {
    it('should not add headers when no usage info in request', (done) => {
      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: (data) => {
          expect(data).toEqual({ success: true });
          expect(mockResponse.setHeader).not.toHaveBeenCalled();
          done();
        },
      });
    });

    it('should add usage remaining header', (done) => {
      mockRequest.usageRemaining = 4;
      mockRequest.usageLimit = 5;
      mockRequest.usageAction = 'application';

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Usage-Remaining', '4');
          expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Usage-Limit', '5');
          expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Usage-Action', 'application');
          done();
        },
      });
    });

    it('should handle unlimited usage (-1)', (done) => {
      mockRequest.usageRemaining = -1;
      mockRequest.usageLimit = -1;
      mockRequest.usageAction = 'interview';

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Usage-Remaining', 'unlimited');
          expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Usage-Limit', 'unlimited');
          expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Usage-Action', 'interview');
          done();
        },
      });
    });

    it('should handle zero remaining', (done) => {
      mockRequest.usageRemaining = 0;
      mockRequest.usageLimit = 5;
      mockRequest.usageAction = 'application';

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Usage-Remaining', '0');
          done();
        },
      });
    });

    it('should preserve original response data', (done) => {
      const originalData = { id: '123', name: 'Test Application' };
      mockCallHandler.handle = jest.fn().mockReturnValue(of(originalData));
      mockRequest.usageRemaining = 3;

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: (data) => {
          expect(data).toEqual(originalData);
          done();
        },
      });
    });
  });
});
