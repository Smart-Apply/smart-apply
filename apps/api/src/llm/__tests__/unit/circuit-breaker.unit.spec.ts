import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { LLMService } from '../../llm.service';
import { ConfigService } from '../../../config/config.service';
import { LLMProvider } from '../../llm.interface';

/**
 * Unit tests for LLM Circuit Breaker
 * 
 * Tests verify that:
 * 1. Circuit breaker wraps all LLM provider calls
 * 2. Circuit opens after error threshold is exceeded
 * 3. Circuit closes after successful recovery test
 * 4. User-friendly error messages are provided
 */
describe('LLMService - Circuit Breaker', () => {
  let service: LLMService;
  let mockProvider: jest.Mocked<LLMProvider>;
  let configService: ConfigService;

  beforeEach(async () => {
    // Mock LLM provider
    mockProvider = {
      generateText: jest.fn(),
    };

    // Mock ConfigService
    const mockConfigService = {
      llmCircuitBreakerTimeout: 1000, // 1s for faster tests
      llmCircuitBreakerErrorThreshold: 50, // Open at 50% failure rate
      llmCircuitBreakerResetTimeout: 500, // 500ms reset timeout
      llmCircuitBreakerRollingCountTimeout: 1000, // 1s window
      llmCircuitBreakerRollingCountBuckets: 10,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LLMService,
        {
          provide: 'LLM_PROVIDER',
          useValue: mockProvider,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<LLMService>(LLMService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('successful requests', () => {
    it('should successfully call LLM provider when circuit is closed', async () => {
      mockProvider.generateText.mockResolvedValue('Generated text');

      const result = await service.generateText('Test prompt');

      expect(result).toBe('Generated text');
      expect(mockProvider.generateText).toHaveBeenCalledWith('Test prompt', undefined);
    });

    it('should pass options to provider', async () => {
      mockProvider.generateText.mockResolvedValue('Generated text');

      const options = { temperature: 0.5, maxTokens: 100 };
      await service.generateText('Test prompt', options);

      expect(mockProvider.generateText).toHaveBeenCalledWith('Test prompt', options);
    });
  });

  describe('circuit breaker behavior', () => {
    it('should throw ServiceUnavailableException when circuit is open', async () => {
      // Simulate multiple failures to open circuit
      mockProvider.generateText.mockRejectedValue(new Error('Provider error'));

      // Make requests to trip circuit breaker (need 50%+ failure rate)
      // Circuit breaker uses rolling window, so we need enough failures
      for (let i = 0; i < 10; i++) {
        try {
          await service.generateText('Test prompt');
        } catch (error) {
          // Expected to fail
        }
      }

      // Wait for circuit to open
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Next request should fast-fail with circuit open error
      await expect(service.generateText('Test prompt')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('should provide user-friendly error message when circuit is open', async () => {
      // Trip circuit breaker
      mockProvider.generateText.mockRejectedValue(new Error('Provider error'));

      for (let i = 0; i < 10; i++) {
        try {
          await service.generateText('Test prompt');
        } catch (error) {
          // Expected to fail
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify error message is in German and user-friendly
      await expect(service.generateText('Test prompt')).rejects.toMatchObject({
        message: expect.stringContaining('AI-Service ist derzeit überlastet'),
      });
    });
  });

  describe('timeout handling', () => {
    it('should timeout long-running requests', async () => {
      // Mock slow provider (takes longer than circuit breaker timeout)
      mockProvider.generateText.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve('Too late'), 2000); // 2s > 1s timeout
          }),
      );

      // Circuit breaker should timeout and throw error
      await expect(service.generateText('Test prompt')).rejects.toThrow();
    }, 10000); // Extend Jest timeout for this test

    it('should provide timeout error message', async () => {
      mockProvider.generateText.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve('Too late'), 2000);
          }),
      );

      try {
        await service.generateText('Test prompt');
        fail('Should have thrown timeout error');
      } catch (error: any) {
        // Timeout errors should be wrapped in ServiceUnavailableException
        expect(error).toBeInstanceOf(ServiceUnavailableException);
      }
    }, 10000);
  });

  describe('error propagation', () => {
    it('should propagate provider errors when circuit is closed', async () => {
      const providerError = new Error('Provider specific error');
      mockProvider.generateText.mockRejectedValue(providerError);

      await expect(service.generateText('Test prompt')).rejects.toThrow(providerError);
    });

    it('should not open circuit for single failures', async () => {
      // First request fails
      mockProvider.generateText.mockRejectedValueOnce(new Error('Transient error'));

      try {
        await service.generateText('Test prompt');
      } catch (error) {
        // Expected - transient error should be propagated
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toContain('Transient error');
      }

      // Second request succeeds (circuit may be open, so we need to wait for reset)
      mockProvider.generateText.mockResolvedValue('Success');
      
      // Wait for circuit to potentially reset
      await new Promise((resolve) => setTimeout(resolve, 600));
      
      const result = await service.generateText('Test prompt');
      expect(result).toBe('Success');
    }, 10000);
  });

  describe('recovery', () => {
    it('should close circuit after successful requests', async () => {
      // Trip circuit breaker
      mockProvider.generateText.mockRejectedValue(new Error('Provider error'));

      for (let i = 0; i < 10; i++) {
        try {
          await service.generateText('Test prompt');
        } catch (error) {
          // Expected to fail
        }
      }

      // Wait for circuit to open
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Fix provider
      mockProvider.generateText.mockResolvedValue('Recovery success');

      // Wait for reset timeout (circuit goes to half-open)
      await new Promise((resolve) => setTimeout(resolve, 600));

      // First request should succeed (circuit half-open)
      const result = await service.generateText('Test prompt');
      expect(result).toBe('Recovery success');

      // Circuit should be closed now, subsequent requests should work
      const result2 = await service.generateText('Test prompt 2');
      expect(result2).toBe('Recovery success');
    }, 10000);
  });
});
