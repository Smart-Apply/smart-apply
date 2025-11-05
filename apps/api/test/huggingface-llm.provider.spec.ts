import { Test, TestingModule } from '@nestjs/testing';
import { HuggingFaceLLMProvider } from '../src/llm/providers/huggingface-llm.provider';
import { ConfigService } from '../src/config/config.service';

// Create a mock instance object that will be returned by HfInference constructor
const mockTextGeneration = jest.fn();

// Mock the @huggingface/inference module
jest.mock('@huggingface/inference', () => {
  return {
    HfInference: jest.fn().mockImplementation(() => ({
      textGeneration: mockTextGeneration,
    })),
  };
});

describe('HuggingFaceLLMProvider', () => {
  let provider: HuggingFaceLLMProvider;

  beforeEach(async () => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    const mockConfigService = {
      huggingFaceApiKey: 'test-api-key',
      huggingFaceModel: 'meta-llama/Llama-2-7b-chat-hf',
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HuggingFaceLLMProvider,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    provider = module.get<HuggingFaceLLMProvider>(HuggingFaceLLMProvider);
  });

  describe('constructor', () => {
    it('should throw error if API key is missing', () => {
      const mockConfigService = {
        huggingFaceApiKey: undefined,
        huggingFaceModel: 'meta-llama/Llama-2-7b-chat-hf',
      };

      expect(() => {
        new HuggingFaceLLMProvider(mockConfigService as any);
      }).toThrow('HUGGINGFACE_API_KEY is required for Hugging Face provider');
    });

    it('should initialize with valid configuration', () => {
      expect(provider).toBeDefined();
    });
  });

  describe('generateText', () => {
    it('should generate text successfully', async () => {
      const mockResponse = {
        generated_text: 'This is a generated response',
      };

      mockTextGeneration.mockResolvedValue(mockResponse);

      const result = await provider.generateText('Test prompt');

      expect(result).toBe('This is a generated response');
      expect(mockTextGeneration).toHaveBeenCalledWith({
        model: 'meta-llama/Llama-2-7b-chat-hf',
        inputs: expect.any(String),
        parameters: {
          temperature: 0.7,
          max_new_tokens: 2000,
          return_full_text: false,
        },
      });
    });

    it('should use custom temperature and maxTokens', async () => {
      const mockResponse = {
        generated_text: 'Generated text',
      };

      mockTextGeneration.mockResolvedValue(mockResponse);

      await provider.generateText('Test prompt', {
        temperature: 0.9,
        maxTokens: 1000,
      });

      expect(mockTextGeneration).toHaveBeenCalledWith({
        model: expect.any(String),
        inputs: expect.any(String),
        parameters: {
          temperature: 0.9,
          max_new_tokens: 1000,
          return_full_text: false,
        },
      });
    });

    it('should format prompt with system message', async () => {
      const mockResponse = {
        generated_text: 'Generated text',
      };

      mockTextGeneration.mockResolvedValue(mockResponse);

      await provider.generateText('User prompt', {
        systemMessage: 'You are a helpful assistant',
      });

      const callArgs = mockTextGeneration.mock.calls[0][0];
      expect(callArgs.inputs).toContain('You are a helpful assistant');
      expect(callArgs.inputs).toContain('User prompt');
    });

    it('should trim generated text', async () => {
      const mockResponse = {
        generated_text: '  Generated text with spaces  ',
      };

      mockTextGeneration.mockResolvedValue(mockResponse);

      const result = await provider.generateText('Test prompt');

      expect(result).toBe('Generated text with spaces');
    });

    it('should throw error if no text is generated', async () => {
      mockTextGeneration.mockResolvedValue({
        generated_text: '',
      });

      await expect(provider.generateText('Test prompt')).rejects.toThrow(
        'No text generated from Hugging Face',
      );
    });

    it('should handle rate limit errors', async () => {
      mockTextGeneration.mockRejectedValue(new Error('rate limit exceeded'));

      await expect(provider.generateText('Test prompt')).rejects.toThrow(
        'Hugging Face rate limit exceeded',
      );
    });

    it('should handle model errors', async () => {
      mockTextGeneration.mockRejectedValue(new Error('Model not found'));

      await expect(provider.generateText('Test prompt')).rejects.toThrow(
        'Hugging Face model error',
      );
    });

    it('should handle generic errors', async () => {
      mockTextGeneration.mockRejectedValue(new Error('Network error'));

      await expect(provider.generateText('Test prompt')).rejects.toThrow(
        'LLM generation failed: Network error',
      );
    });
  });

  describe('prompt formatting', () => {
    beforeEach(() => {
      mockTextGeneration.mockResolvedValue({
        generated_text: 'Response',
      });
    });

    it('should format Llama 2 prompts correctly', async () => {
      // Test with Llama 2 model
      const mockConfigService = {
        huggingFaceApiKey: 'test-api-key',
        huggingFaceModel: 'meta-llama/Llama-2-7b-chat-hf',
      };

      const testProvider = new HuggingFaceLLMProvider(mockConfigService as any);

      await testProvider.generateText('Hello', {
        systemMessage: 'You are helpful',
      });

      const callArgs = mockTextGeneration.mock.calls[0][0];
      expect(callArgs.inputs).toContain('[INST]');
      expect(callArgs.inputs).toContain('<<SYS>>');
    });

    it('should format Mistral prompts correctly', async () => {
      const mockConfigService = {
        huggingFaceApiKey: 'test-api-key',
        huggingFaceModel: 'mistralai/Mistral-7B-Instruct-v0.1',
      };

      const testProvider = new HuggingFaceLLMProvider(mockConfigService as any);

      await testProvider.generateText('Hello');

      const callArgs = mockTextGeneration.mock.calls[0][0];
      expect(callArgs.inputs).toContain('<s>[INST]');
      expect(callArgs.inputs).toContain('[/INST]');
    });

    it('should use default format for unknown models', async () => {
      const mockConfigService = {
        huggingFaceApiKey: 'test-api-key',
        huggingFaceModel: 'unknown/model',
      };

      const testProvider = new HuggingFaceLLMProvider(mockConfigService as any);

      await testProvider.generateText('Hello', {
        systemMessage: 'System message',
      });

      const callArgs = mockTextGeneration.mock.calls[0][0];
      expect(callArgs.inputs).toContain('System:');
      expect(callArgs.inputs).toContain('User:');
    });
  });
});
