export interface LLMProvider {
  /**
   * Generate text completion from a prompt
   * @param prompt - The prompt to generate from
   * @param options - Additional options
   * @returns Generated text
   */
  generateText(prompt: string, options?: GenerateOptions): Promise<string>;
}

export interface GenerateOptions {
  temperature?: number;
  maxTokens?: number;
  systemMessage?: string;
}
