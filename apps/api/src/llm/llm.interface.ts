export interface LLMProvider {
  /**
   * Generate text completion from a prompt
   * @param prompt - The prompt to generate from
   * @param options - Additional options
   * @returns Generated text
   */
  generateText(prompt: string, options?: GenerateOptions): Promise<string>;

  /**
   * Health check for the LLM provider
   * @returns true if the provider is healthy, false otherwise
   */
  healthCheck?(): Promise<boolean>;
}

export interface GenerateOptions {
  temperature?: number;
  maxTokens?: number;
  systemMessage?: string;
}
