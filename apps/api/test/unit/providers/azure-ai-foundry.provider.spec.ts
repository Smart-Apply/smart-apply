import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { AzureAIFoundryProvider } from '../../../src/llm/providers/azure-ai-foundry.provider';
import { ConfigService } from '../../../src/config/config.service';

describe('AzureAIFoundryProvider', () => {
  let provider: AzureAIFoundryProvider;
  let httpService: HttpService;
  let configService: ConfigService;

  const mockHttpPost = jest.fn();

  beforeEach(async () => {
    const mockConfigService = {
      azureAIFoundryCvWriterEndpoint: 'https://cv-writer.azure.com/score',
      azureAIFoundryClWriterEndpoint: 'https://cl-writer.azure.com/score',
      azureAIFoundryApiKey: 'test-ai-foundry-key',
      azureOpenAIEndpoint: 'https://test.openai.azure.com',
      azureOpenAIApiKey: 'test-openai-key',
      azureOpenAIDeploymentName: 'gpt-4o',
      azureOpenAIApiVersion: '2024-02-15-preview',
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AzureAIFoundryProvider,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: HttpService,
          useValue: {
            post: mockHttpPost,
          },
        },
      ],
    }).compile();

    provider = module.get<AzureAIFoundryProvider>(AzureAIFoundryProvider);
    httpService = module.get<HttpService>(HttpService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with valid configuration', () => {
      expect(provider).toBeDefined();
    });

    it('should warn if Azure AI Foundry configuration is missing', () => {
      const mockConfigService = {
        azureAIFoundryCvWriterEndpoint: undefined,
        azureAIFoundryClWriterEndpoint: undefined,
        azureAIFoundryApiKey: undefined,
        azureOpenAIEndpoint: 'https://test.openai.azure.com',
        azureOpenAIApiKey: 'test-key',
        azureOpenAIDeploymentName: 'gpt-4o',
        azureOpenAIApiVersion: '2024-02-15-preview',
      };

      // Should not throw, just warn
      expect(
        () => new AzureAIFoundryProvider(httpService, mockConfigService as any),
      ).not.toThrow();
    });

    it('should warn if Azure OpenAI fallback configuration is missing', () => {
      const mockConfigService = {
        azureAIFoundryCvWriterEndpoint: 'https://cv-writer.azure.com/score',
        azureAIFoundryClWriterEndpoint: 'https://cl-writer.azure.com/score',
        azureAIFoundryApiKey: 'test-key',
        azureOpenAIEndpoint: undefined,
        azureOpenAIApiKey: undefined,
        azureOpenAIDeploymentName: 'gpt-4o',
        azureOpenAIApiVersion: '2024-02-15-preview',
      };

      // Should not throw, just warn
      expect(
        () => new AzureAIFoundryProvider(httpService, mockConfigService as any),
      ).not.toThrow();
    });
  });

  describe('generateText - Resume Generation', () => {
    it('should call CV Writer Agent for resume prompts', async () => {
      const mockResponse = {
        data: {
          content: 'Generated resume content',
        },
      };

      mockHttpPost.mockReturnValue(of(mockResponse));

      const result = await provider.generateText('Generate a resume with work experience', {
        temperature: 0.6,
        maxTokens: 2500,
      });

      expect(result).toBe('Generated resume content');
      expect(mockHttpPost).toHaveBeenCalledWith(
        'https://cv-writer.azure.com/score',
        expect.objectContaining({
          prompt: 'Generate a resume with work experience',
          temperature: 0.6,
          maxTokens: 2500,
        }),
        expect.objectContaining({
          headers: {
            'api-key': 'test-ai-foundry-key',
            'Content-Type': 'application/json',
          },
          timeout: 60000,
        }),
      );
    });

    it('should detect resume keywords correctly', async () => {
      const resumePrompts = [
        'Create a resume for software engineer',
        'Build my CV with qualifications',
        'Generate curriculum vitae with education',
        'Professional experience summary',
      ];

      const mockResponse = {
        data: {
          content: 'Generated content',
        },
      };

      mockHttpPost.mockReturnValue(of(mockResponse));

      for (const prompt of resumePrompts) {
        await provider.generateText(prompt);
        expect(mockHttpPost).toHaveBeenCalledWith(
          'https://cv-writer.azure.com/score',
          expect.any(Object),
          expect.any(Object),
        );
        mockHttpPost.mockClear();
      }
    });

    it('should handle various CV Writer response formats', async () => {
      const responseFormats = [
        { data: 'Direct string response' },
        { data: { content: 'Content property' } },
        { data: { message: { content: 'Nested message content' } } },
        { data: { choices: [{ message: { content: 'Choices format' } }] } },
        { data: { choices: [{ text: 'Choices text format' }] } },
        { data: { text: 'Text property' } },
        { data: { result: 'Result property' } },
      ];

      const expectedContents = [
        'Direct string response',
        'Content property',
        'Nested message content',
        'Choices format',
        'Choices text format',
        'Text property',
        'Result property',
      ];

      for (let i = 0; i < responseFormats.length; i++) {
        mockHttpPost.mockReturnValue(of(responseFormats[i]));
        const result = await provider.generateText('Generate resume');
        expect(result).toBe(expectedContents[i]);
        mockHttpPost.mockClear();
      }
    });
  });

  describe('generateText - Cover Letter Generation', () => {
    it('should call CL Writer Agent for cover letter prompts', async () => {
      const mockResponse = {
        data: {
          content: 'Generated cover letter content',
        },
      };

      mockHttpPost.mockReturnValue(of(mockResponse));

      const result = await provider.generateText('Create a cover letter for job application', {
        temperature: 0.7,
        maxTokens: 1500,
        systemMessage: 'You are a professional career coach',
      });

      expect(result).toBe('Generated cover letter content');
      expect(mockHttpPost).toHaveBeenCalledWith(
        'https://cl-writer.azure.com/score',
        expect.objectContaining({
          prompt: 'Create a cover letter for job application',
          temperature: 0.7,
          maxTokens: 1500,
          systemMessage: 'You are a professional career coach',
        }),
        expect.objectContaining({
          headers: {
            'api-key': 'test-ai-foundry-key',
            'Content-Type': 'application/json',
          },
          timeout: 60000,
        }),
      );
    });

    it('should detect cover letter keywords correctly', async () => {
      const coverLetterPrompts = [
        'Write a cover letter for this position',
        'Create motivation letter for job',
        'Dear hiring manager application',
        'I am writing to express my interest',
      ];

      const mockResponse = {
        data: {
          content: 'Generated content',
        },
      };

      mockHttpPost.mockReturnValue(of(mockResponse));

      for (const prompt of coverLetterPrompts) {
        await provider.generateText(prompt);
        expect(mockHttpPost).toHaveBeenCalledWith(
          'https://cl-writer.azure.com/score',
          expect.any(Object),
          expect.any(Object),
        );
        mockHttpPost.mockClear();
      }
    });
  });

  describe('Fallback to Azure OpenAI', () => {
    it('should fallback to Azure OpenAI when CV Writer Agent fails', async () => {
      // First call fails (CV Writer Agent)
      mockHttpPost.mockReturnValueOnce(
        throwError(() => new Error('Agent endpoint unavailable')),
      );

      // Second call succeeds (Azure OpenAI fallback)
      const fallbackResponse = {
        data: {
          choices: [
            {
              message: {
                content: 'Fallback generated resume',
              },
            },
          ],
        },
      };
      mockHttpPost.mockReturnValueOnce(of(fallbackResponse));

      const result = await provider.generateText('Generate a resume');

      expect(result).toBe('Fallback generated resume');
      expect(mockHttpPost).toHaveBeenCalledTimes(2);

      // Verify fallback call to Azure OpenAI
      const fallbackCall = mockHttpPost.mock.calls[1];
      expect(fallbackCall[0]).toContain('openai.azure.com');
      expect(fallbackCall[0]).toContain('gpt-4o');
    });

    it('should fallback to Azure OpenAI when CL Writer Agent fails', async () => {
      // First call fails (CL Writer Agent)
      mockHttpPost.mockReturnValueOnce(throwError(() => new Error('Agent timeout')));

      // Second call succeeds (Azure OpenAI fallback)
      const fallbackResponse = {
        data: {
          choices: [
            {
              message: {
                content: 'Fallback generated cover letter',
              },
            },
          ],
        },
      };
      mockHttpPost.mockReturnValueOnce(of(fallbackResponse));

      const result = await provider.generateText('Write a cover letter');

      expect(result).toBe('Fallback generated cover letter');
      expect(mockHttpPost).toHaveBeenCalledTimes(2);
    });

    it('should use Azure OpenAI when no agent endpoint matches', async () => {
      const fallbackResponse = {
        data: {
          choices: [
            {
              message: {
                content: 'OpenAI generated content',
              },
            },
          ],
        },
      };
      mockHttpPost.mockReturnValue(of(fallbackResponse));

      const result = await provider.generateText('Some generic text generation request');

      expect(result).toBe('OpenAI generated content');
      expect(mockHttpPost).toHaveBeenCalledTimes(1);

      // Verify it called Azure OpenAI directly
      const call = mockHttpPost.mock.calls[0];
      expect(call[0]).toContain('openai.azure.com');
    });

    it('should throw error if agent fails and fallback is not configured', async () => {
      const mockConfigServiceNoFallback = {
        azureAIFoundryCvWriterEndpoint: 'https://cv-writer.azure.com/score',
        azureAIFoundryClWriterEndpoint: 'https://cl-writer.azure.com/score',
        azureAIFoundryApiKey: 'test-key',
        azureOpenAIEndpoint: undefined,
        azureOpenAIApiKey: undefined,
        azureOpenAIDeploymentName: 'gpt-4o',
        azureOpenAIApiVersion: '2024-02-15-preview',
      };

      const providerNoFallback = new AzureAIFoundryProvider(
        httpService,
        mockConfigServiceNoFallback as any,
      );

      // CV Writer Agent fails
      mockHttpPost.mockReturnValue(throwError(() => new Error('Agent failed')));

      await expect(providerNoFallback.generateText('Generate resume')).rejects.toThrow(
        'Azure AI Foundry agents unavailable and Azure OpenAI fallback not configured',
      );
    });

    it('should include system message in fallback call', async () => {
      const fallbackResponse = {
        data: {
          choices: [{ message: { content: 'Response' } }],
        },
      };
      mockHttpPost.mockReturnValue(of(fallbackResponse));

      await provider.generateText('Generic prompt', {
        systemMessage: 'You are a helpful assistant',
        temperature: 0.8,
        maxTokens: 1000,
      });

      const fallbackCall = mockHttpPost.mock.calls[0];
      const requestBody = fallbackCall[1];

      expect(requestBody.messages).toHaveLength(2);
      expect(requestBody.messages[0]).toEqual({
        role: 'system',
        content: 'You are a helpful assistant',
      });
      expect(requestBody.messages[1]).toEqual({
        role: 'user',
        content: 'Generic prompt',
      });
      expect(requestBody.temperature).toBe(0.8);
      expect(requestBody.max_tokens).toBe(1000);
    });
  });

  describe('Error Handling', () => {
    it('should throw error when CV Writer returns no content', async () => {
      mockHttpPost.mockReturnValue(
        of({
          data: {},
        }),
      );

      await expect(provider.generateText('Generate resume')).rejects.toThrow(
        'No content in CV Writer Agent response',
      );
    });

    it('should throw error when CL Writer returns no content', async () => {
      mockHttpPost.mockReturnValue(
        of({
          data: {},
        }),
      );

      await expect(provider.generateText('Write cover letter')).rejects.toThrow(
        'No content in CL Writer Agent response',
      );
    });

    it('should handle network errors gracefully', async () => {
      mockHttpPost.mockReturnValueOnce(throwError(() => new Error('Network timeout')));

      // Fallback also fails
      mockHttpPost.mockReturnValueOnce(throwError(() => new Error('Fallback network error')));

      await expect(provider.generateText('Generate resume')).rejects.toThrow(
        'LLM generation failed',
      );
    });

    it('should handle Azure OpenAI fallback errors', async () => {
      // Agent fails
      mockHttpPost.mockReturnValueOnce(throwError(() => new Error('Agent failed')));

      // Fallback returns empty response
      mockHttpPost.mockReturnValueOnce(
        of({
          data: {
            choices: [],
          },
        }),
      );

      await expect(provider.generateText('Generate resume')).rejects.toThrow(
        'No content in Azure OpenAI fallback response',
      );
    });
  });

  describe('Default Options', () => {
    it('should use default temperature for CV Writer', async () => {
      const mockResponse = {
        data: { content: 'Resume' },
      };
      mockHttpPost.mockReturnValue(of(mockResponse));

      await provider.generateText('Generate resume');

      const call = mockHttpPost.mock.calls[0];
      expect(call[1].temperature).toBe(0.6); // Default for resume
    });

    it('should use default temperature for CL Writer', async () => {
      const mockResponse = {
        data: { content: 'Cover letter' },
      };
      mockHttpPost.mockReturnValue(of(mockResponse));

      await provider.generateText('Write cover letter');

      const call = mockHttpPost.mock.calls[0];
      expect(call[1].temperature).toBe(0.7); // Default for cover letter
    });

    it('should use default maxTokens for CV Writer', async () => {
      const mockResponse = {
        data: { content: 'Resume' },
      };
      mockHttpPost.mockReturnValue(of(mockResponse));

      await provider.generateText('Generate resume');

      const call = mockHttpPost.mock.calls[0];
      expect(call[1].maxTokens).toBe(2500); // Default for resume
    });

    it('should use default maxTokens for CL Writer', async () => {
      const mockResponse = {
        data: { content: 'Cover letter' },
      };
      mockHttpPost.mockReturnValue(of(mockResponse));

      await provider.generateText('Write cover letter');

      const call = mockHttpPost.mock.calls[0];
      expect(call[1].maxTokens).toBe(1500); // Default for cover letter
    });
  });
});
