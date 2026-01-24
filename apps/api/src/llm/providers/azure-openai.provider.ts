import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '../../config/config.service';
import { LLMProvider, GenerateOptions } from '../llm.interface';

@Injectable()
export class AzureOpenAIProvider implements LLMProvider {
  private readonly logger = new Logger(AzureOpenAIProvider.name);
  private readonly endpoint: string;
  private readonly apiKey: string;
  private readonly deploymentName: string;
  private readonly apiVersion: string;

  constructor(
    private httpService: HttpService,
    private configService: ConfigService,
  ) {
    this.endpoint = this.configService.azureOpenAIEndpoint || '';
    this.apiKey = this.configService.azureOpenAIApiKey || '';
    this.deploymentName = this.configService.azureOpenAIDeploymentName;
    this.apiVersion = this.configService.azureOpenAIApiVersion;

    if (!this.endpoint || !this.apiKey) {
      throw new Error('Azure OpenAI configuration missing');
    }
  }

  async generateText(prompt: string, options?: GenerateOptions): Promise<string> {
    const url = `${this.endpoint}/openai/deployments/${this.deploymentName}/chat/completions?api-version=${this.apiVersion}`;

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
              'api-key': this.apiKey,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      const content = response.data.choices[0]?.message?.content;

      if (!content) {
        throw new Error('No content in OpenAI response');
      }

      this.logger.log('Successfully generated text with Azure OpenAI');
      return content;
    } catch (error: any) {
      this.logger.error('Azure OpenAI generation failed', error.message);
      throw new Error(`LLM generation failed: ${error.message}`);
    }
  }

  /**
   * Health check for Azure OpenAI
   * Validates configuration and endpoint availability
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Validate configuration exists
      if (!this.endpoint || !this.apiKey || !this.deploymentName) {
        this.logger.warn('Azure OpenAI health check failed: Missing configuration');
        return false;
      }

      // Make a minimal API call to verify connectivity
      const url = `${this.endpoint}/openai/deployments/${this.deploymentName}/chat/completions?api-version=${this.apiVersion}`;
      
      const response = await firstValueFrom(
        this.httpService.post(
          url,
          {
            messages: [{ role: 'user', content: 'health check' }],
            max_tokens: 1,
          },
          {
            headers: {
              'api-key': this.apiKey,
              'Content-Type': 'application/json',
            },
            timeout: 5000, // 5 second timeout for health check
          },
        ),
      );

      const isHealthy = response.status === 200;
      this.logger.debug(`Azure OpenAI health check: ${isHealthy ? 'OK' : 'FAILED'}`);
      return isHealthy;
    } catch (error: any) {
      this.logger.warn(`Azure OpenAI health check failed: ${error.message}`);
      return false;
    }
  }
}
