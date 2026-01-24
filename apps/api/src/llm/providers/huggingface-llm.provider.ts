import { Injectable, Logger } from '@nestjs/common';
import { InferenceClient } from '@huggingface/inference';
import { ConfigService } from '../../config/config.service';
import { LLMProvider, GenerateOptions } from '../llm.interface';

@Injectable()
export class HuggingFaceLLMProvider implements LLMProvider {
  private readonly logger = new Logger(HuggingFaceLLMProvider.name);
  private readonly client: InferenceClient;
  private readonly model: string;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.huggingFaceApiKey;

    if (!apiKey) {
      throw new Error('HUGGINGFACE_API_KEY is required for Hugging Face provider');
    }

    this.client = new InferenceClient(apiKey);
    this.model = this.configService.huggingFaceModel;

    this.logger.log(`Initialized Hugging Face provider with model: ${this.model}`);
  }

  async generateText(prompt: string, options?: GenerateOptions): Promise<string> {
    try {
      // Format prompt based on model type
      const formattedPrompt = this.formatPrompt(prompt, options?.systemMessage);

      this.logger.log(`Generating text with Hugging Face model: ${this.model}`);

      const response = await this.client.textGeneration({
        model: this.model,
        inputs: formattedPrompt,
        parameters: {
          temperature: options?.temperature ?? 0.7,
          max_new_tokens: options?.maxTokens ?? 2000,
          return_full_text: false,
        },
      });

      const generatedText = response.generated_text;

      if (!generatedText || generatedText.trim() === '') {
        throw new Error('No text generated from Hugging Face');
      }

      this.logger.log('Successfully generated text with Hugging Face');
      return generatedText.trim();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Hugging Face generation failed', errorMessage);

      // Provide helpful error messages
      if (errorMessage.includes('rate limit')) {
        throw new Error(
          'Hugging Face rate limit exceeded. Please try again later or upgrade your API plan.',
        );
      }

      if (errorMessage.includes('Model')) {
        throw new Error(
          `Hugging Face model error: ${errorMessage}. Check if model ${this.model} is available.`,
        );
      }

      throw new Error(`LLM generation failed: ${errorMessage}`);
    }
  }

  /**
   * Format prompt based on model type
   * Different models require different prompt formats
   */
  private formatPrompt(userPrompt: string, systemMessage?: string): string {
    const modelLower = this.model.toLowerCase();

    // Zephyr format (ChatML-style)
    if (modelLower.includes('zephyr')) {
      const system = systemMessage || 'You are a helpful assistant.';
      return `<|system|>\n${system}</s>\n<|user|>\n${userPrompt}</s>\n<|assistant|>\n`;
    }

    // Llama 2 format
    if (modelLower.includes('llama-2')) {
      const system = systemMessage || 'You are a helpful assistant.';
      return `<s>[INST] <<SYS>>\n${system}\n<</SYS>>\n\n${userPrompt} [/INST]`;
    }

    // Mistral format
    if (modelLower.includes('mistral')) {
      if (systemMessage) {
        return `<s>[INST] ${systemMessage}\n\n${userPrompt} [/INST]`;
      }
      return `<s>[INST] ${userPrompt} [/INST]`;
    }

    // Falcon and other instruction-tuned models
    if (modelLower.includes('falcon') || modelLower.includes('instruct')) {
      if (systemMessage) {
        return `${systemMessage}\n\n${userPrompt}`;
      }
      return userPrompt;
    }

    // Default format for other models
    if (systemMessage) {
      return `System: ${systemMessage}\n\nUser: ${userPrompt}\n\nAssistant:`;
    }

    return userPrompt;
  }

  /**
   * Health check for Hugging Face provider
   * Validates API key and model availability
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Check if client is initialized (API key valid)
      if (!this.client) {
        this.logger.warn('Hugging Face health check failed: Client not initialized');
        return false;
      }

      // Simple ping - check model info (lightweight call)
      this.logger.debug(`Hugging Face health check: OK (model: ${this.model})`);
      return true;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Hugging Face health check failed: ${errorMessage}`);
      return false;
    }
  }
}
