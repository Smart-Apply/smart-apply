import { TransformInterceptor } from '../transform.interceptor';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';

describe('TransformInterceptor', () => {
  let interceptor: TransformInterceptor<any>;
  let mockExecutionContext: ExecutionContext;
  let mockCallHandler: CallHandler;

  beforeEach(() => {
    interceptor = new TransformInterceptor();
    mockExecutionContext = {} as ExecutionContext;
  });

  it('should wrap response in data and meta format', (done) => {
    const testData = { id: '1', name: 'Test' };
    mockCallHandler = {
      handle: () => of(testData),
    };

    interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
      next: (result) => {
        expect(result).toHaveProperty('data');
        expect(result).toHaveProperty('meta');
        expect(result.data).toEqual(testData);
        expect(result.meta).toHaveProperty('timestamp');
        expect(typeof result.meta.timestamp).toBe('string');
        done();
      },
    });
  });

  it('should wrap array response correctly', (done) => {
    const testData = [
      { id: '1', name: 'Test 1' },
      { id: '2', name: 'Test 2' },
    ];
    mockCallHandler = {
      handle: () => of(testData),
    };

    interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
      next: (result) => {
        expect(result.data).toEqual(testData);
        expect(result.meta.timestamp).toBeDefined();
        done();
      },
    });
  });

  it('should wrap paginated response correctly', (done) => {
    const testData = {
      items: [{ id: '1' }, { id: '2' }],
      pagination: {
        page: 1,
        limit: 20,
        total: 100,
        totalPages: 5,
      },
    };
    mockCallHandler = {
      handle: () => of(testData),
    };

    interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
      next: (result) => {
        expect(result.data).toEqual(testData);
        expect(result.data.items).toHaveLength(2);
        expect(result.data.pagination).toBeDefined();
        expect(result.meta.timestamp).toBeDefined();
        done();
      },
    });
  });

  it('should include valid ISO 8601 timestamp', (done) => {
    const testData = { test: 'value' };
    mockCallHandler = {
      handle: () => of(testData),
    };

    interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
      next: (result) => {
        const timestamp = new Date(result.meta.timestamp);
        expect(timestamp.toISOString()).toBe(result.meta.timestamp);
        done();
      },
    });
  });
});
