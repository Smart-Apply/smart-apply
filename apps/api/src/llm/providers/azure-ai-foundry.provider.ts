import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '../../config/config.service';
import { LLMProvider, GenerateOptions } from '../llm.interface';

/**
 * Azure AI Foundry Agent Provider
 * Leverages specialized AI agents (CV Writer & CL Writer) deployed in Azure AI Foundry.
 * Falls back to Azure OpenAI if agent calls fail.
 */
@Injectable()
export class AzureAIFoundryProvider implements LLMProvider {
  private readonly logger = new Logger(AzureAIFoundryProvider.name);
  private readonly cvWriterEndpoint: string;
  private readonly clWriterEndpoint: string;
  private readonly apiKey: string;

  // Fallback to Azure OpenAI
  private readonly azureOpenAIEndpoint: string;
  private readonly azureOpenAIApiKey: string;
  private readonly azureOpenAIDeploymentName: string;
  private readonly azureOpenAIApiVersion: string;

  constructor(
    private httpService: HttpService,
    private configService: ConfigService,
  ) {
    // Azure AI Foundry configuration
    this.cvWriterEndpoint = this.configService.azureAIFoundryCvWriterEndpoint || '';
    this.clWriterEndpoint = this.configService.azureAIFoundryClWriterEndpoint || '';
    this.apiKey = this.configService.azureAIFoundryApiKey || '';

    // Azure OpenAI fallback configuration
    this.azureOpenAIEndpoint = this.configService.azureOpenAIEndpoint || '';
    this.azureOpenAIApiKey = this.configService.azureOpenAIApiKey || '';
    this.azureOpenAIDeploymentName = this.configService.azureOpenAIDeploymentName;
    this.azureOpenAIApiVersion = this.configService.azureOpenAIApiVersion;

    if (!this.cvWriterEndpoint || !this.clWriterEndpoint || !this.apiKey) {
      this.logger.warn(
        'Azure AI Foundry agent endpoints or API key not configured. Will use fallback.',
      );
    }

    if (!this.azureOpenAIEndpoint || !this.azureOpenAIApiKey) {
      this.logger.warn(
        'Azure OpenAI fallback configuration missing. Provider may fail if agents are unavailable.',
      );
    }
  }

  async generateText(prompt: string, options?: GenerateOptions): Promise<string> {
    // Determine which agent to call based on prompt content
    const isResume = this.isResumePrompt(prompt);
    const isCoverLetter = this.isCoverLetterPrompt(prompt);

    try {
      if (isResume && this.cvWriterEndpoint) {
        this.logger.log('Calling CV Writer Agent for resume generation');
        return await this.callCVWriterAgent(prompt, options);
      } else if (isCoverLetter && this.clWriterEndpoint) {
        this.logger.log('Calling CL Writer Agent for cover letter generation');
        return await this.callCLWriterAgent(prompt, options);
      } else {
        this.logger.log('No matching agent endpoint, using Azure OpenAI fallback');
        return await this.fallbackToAzureOpenAI(prompt, options);
      }
    } catch (error: any) {
      this.logger.error(
        `Azure AI Foundry agent failed: ${error.message}. Falling back to Azure OpenAI`,
      );
      return await this.fallbackToAzureOpenAI(prompt, options);
    }
  }

  /**
   * Call the CV Writer Agent for resume generation
   */
  private async callCVWriterAgent(prompt: string, options?: GenerateOptions): Promise<string> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          this.cvWriterEndpoint,
          {
            prompt,
            temperature: options?.temperature ?? 0.6,
            maxTokens: options?.maxTokens ?? 2500,
            systemMessage: options?.systemMessage,
          },
          {
            headers: {
              'api-key': this.apiKey,
              'Content-Type': 'application/json',
            },
            timeout: 60000, // 60 second timeout for agent processing
          },
        ),
      );

      const content = this.extractContentFromResponse(response.data);

      if (!content) {
        throw new Error('No content in CV Writer Agent response');
      }

      this.logger.log('Successfully generated resume with CV Writer Agent');
      return content;
    } catch (error: any) {
      this.logger.error(`CV Writer Agent call failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Call the CL Writer Agent for cover letter generation
   */
  private async callCLWriterAgent(prompt: string, options?: GenerateOptions): Promise<string> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          this.clWriterEndpoint,
          {
            prompt,
            temperature: options?.temperature ?? 0.7,
            maxTokens: options?.maxTokens ?? 1500,
            systemMessage: options?.systemMessage,
          },
          {
            headers: {
              'api-key': this.apiKey,
              'Content-Type': 'application/json',
            },
            timeout: 60000, // 60 second timeout for agent processing
          },
        ),
      );

      const content = this.extractContentFromResponse(response.data);

      if (!content) {
        throw new Error('No content in CL Writer Agent response');
      }

      this.logger.log('Successfully generated cover letter with CL Writer Agent');
      return content;
    } catch (error: any) {
      this.logger.error(`CL Writer Agent call failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Extract content from Azure AI Foundry agent response
   * Supports multiple response formats
   */
  private extractContentFromResponse(data: any): string {
    // Try different response formats that Azure AI Foundry might use
    if (typeof data === 'string') {
      return data;
    }

    if (data.content) {
      return data.content;
    }

    if (data.message?.content) {
      return data.message.content;
    }

    if (data.choices && data.choices[0]?.message?.content) {
      return data.choices[0].message.content;
    }

    if (data.choices && data.choices[0]?.text) {
      return data.choices[0].text;
    }

    if (data.text) {
      return data.text;
    }

    if (data.result) {
      return data.result;
    }

    return '';
  }

  /**
   * Fallback to Azure OpenAI if agents fail
   */
  private async fallbackToAzureOpenAI(prompt: string, options?: GenerateOptions): Promise<string> {
    if (!this.azureOpenAIEndpoint || !this.azureOpenAIApiKey) {
      throw new Error(
        'Azure AI Foundry agents unavailable and Azure OpenAI fallback not configured',
      );
    }

    const url = `${this.azureOpenAIEndpoint}/openai/deployments/${this.azureOpenAIDeploymentName}/chat/completions?api-version=${this.azureOpenAIApiVersion}`;

    const messages: any[] = [];

    if (options?.systemMessage) {
      messages.push({
        role: 'system',
        content: options.systemMessage,
      });
    }

    messages.push({
      role: 'user',
      content: prompt,
    });

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          url,
          {
            messages,
            temperature: options?.temperature ?? 0.7,
            max_tokens: options?.maxTokens ?? 2000,
          },
          {
            headers: {
              'api-key': this.azureOpenAIApiKey,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      const content = response.data.choices[0]?.message?.content;

      if (!content) {
        throw new Error('No content in Azure OpenAI fallback response');
      }

      this.logger.log('Successfully generated text with Azure OpenAI fallback');
      return content;
    } catch (error: any) {
      this.logger.error('Azure OpenAI fallback failed', error.message);
      throw new Error(`LLM generation failed: ${error.message}`);
    }
  }

  /**
   * Detect if the prompt is for resume generation
   */
  private isResumePrompt(prompt: string): boolean {
    const resumeKeywords = [
      'resume',
      'cv',
      'curriculum vitae',
      'work experience',
      'professional experience',
      'education',
      'skills',
      'qualifications',
    ];

    const lowerPrompt = prompt.toLowerCase();
    return resumeKeywords.some((keyword) => lowerPrompt.includes(keyword));
  }

  /**
   * Detect if the prompt is for cover letter generation
   */
  private isCoverLetterPrompt(prompt: string): boolean {
    const coverLetterKeywords = [
      'cover letter',
      'motivation letter',
      'application letter',
      'dear hiring manager',
      'i am writing to express',
    ];

    const lowerPrompt = prompt.toLowerCase();
    return coverLetterKeywords.some((keyword) => lowerPrompt.includes(keyword));
  }
}
