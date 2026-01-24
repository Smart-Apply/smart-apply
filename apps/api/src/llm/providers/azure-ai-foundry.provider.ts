import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AgentsClient } from '@azure/ai-agents';
import { DefaultAzureCredential } from '@azure/identity';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '../../config/config.service';
import { LLMProvider, GenerateOptions } from '../llm.interface';

/**
 * Azure AI Foundry Agent Provider
 * Uses Azure AI Agents SDK to leverage specialized AI agents (CV Writer & CL Writer).
 * Falls back to Azure OpenAI if agent calls fail.
 */
@Injectable()
export class AzureAIFoundryProvider implements LLMProvider, OnModuleInit {
  private readonly logger = new Logger(AzureAIFoundryProvider.name);
  private agentsClient: AgentsClient | null = null;

  private readonly projectEndpoint: string;
  private readonly cvWriterAgentId: string;
  private readonly clWriterAgentId: string;

  // Fallback to Azure OpenAI
  private readonly azureOpenAIEndpoint: string;
  private readonly azureOpenAIApiKey: string;
  private readonly azureOpenAIDeploymentName: string;
  private readonly azureOpenAIApiVersion: string;

  constructor(
    private httpService: HttpService,
    private configService: ConfigService,
  ) {
    // Azure AI Foundry Agents configuration
    this.projectEndpoint = process.env.PROJECT_ENDPOINT || '';
    this.cvWriterAgentId = process.env.CV_WRITER_AGENT_ID || '';
    this.clWriterAgentId = process.env.CL_WRITER_AGENT_ID || '';

    // Azure OpenAI fallback configuration
    this.azureOpenAIEndpoint = this.configService.azureOpenAIEndpoint || '';
    this.azureOpenAIApiKey = this.configService.azureOpenAIApiKey || '';
    this.azureOpenAIDeploymentName = this.configService.azureOpenAIDeploymentName;
    this.azureOpenAIApiVersion = this.configService.azureOpenAIApiVersion;

    if (!this.projectEndpoint) {
      this.logger.warn('PROJECT_ENDPOINT not configured. Azure AI Foundry agents disabled.');
    }

    if (!this.cvWriterAgentId || !this.clWriterAgentId) {
      this.logger.warn(
        'Agent IDs not configured. Run "npm run create-agents" to create agents. Will use fallback.',
      );
    }

    if (!this.azureOpenAIEndpoint || !this.azureOpenAIApiKey) {
      this.logger.warn(
        'Azure OpenAI fallback configuration missing. Provider may fail if agents are unavailable.',
      );
    }
  }

  async onModuleInit() {
    // Initialize Azure AI Agents Client with Managed Identity
    if (this.projectEndpoint && this.cvWriterAgentId && this.clWriterAgentId) {
      try {
        this.agentsClient = new AgentsClient(this.projectEndpoint, new DefaultAzureCredential());
        this.logger.log('Azure AI Foundry Agents Client initialized successfully');
      } catch (error) {
        this.logger.error('Failed to initialize Azure AI Foundry Agents Client', error);
        this.logger.warn('Will use Azure OpenAI fallback for all requests');
      }
    }
  }

  async generateText(prompt: string, options?: GenerateOptions): Promise<string> {
    // Determine which agent to call based on prompt content
    const isResume = this.isResumePrompt(prompt);
    const isCoverLetter = this.isCoverLetterPrompt(prompt);

    this.logger.debug(
      `Prompt detection - Resume: ${isResume}, CoverLetter: ${isCoverLetter}, PromptStart: "${prompt.substring(0, 100)}"`,
    );

    try {
      if (!this.agentsClient) {
        this.logger.warn('Agents client not initialized, using fallback');
        return await this.fallbackToAzureOpenAI(prompt, options);
      }

      // Check cover letter FIRST - it's more specific (prompts often contain both keywords)
      if (isCoverLetter && this.clWriterAgentId) {
        this.logger.log('Calling CL Writer Agent for cover letter generation');
        return await this.callAgent(this.clWriterAgentId, prompt, 'CL Writer');
      } else if (isResume && this.cvWriterAgentId) {
        this.logger.log('Calling CV Writer Agent for resume generation');
        return await this.callAgent(this.cvWriterAgentId, prompt, 'CV Writer');
      } else {
        this.logger.log(
          `No matching agent - isResume: ${isResume}, isCoverLetter: ${isCoverLetter}, cvAgentId: ${this.cvWriterAgentId}, clAgentId: ${this.clWriterAgentId}`,
        );
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
   * Call an Azure AI Agent using the Agents SDK
   */
  private async callAgent(agentId: string, prompt: string, agentName: string): Promise<string> {
    if (!this.agentsClient) {
      throw new Error('Agents client not initialized');
    }

    try {
      // Create a new thread for this conversation
      const thread = await this.agentsClient.threads.create();
      this.logger.debug(`Created thread ${thread.id} for ${agentName}`);

      try {
        // Create a message in the thread
        await this.agentsClient.messages.create(thread.id, 'user', prompt);

        // Create and poll a run (wait for agent to process)
        const run = await this.agentsClient.runs.createAndPoll(thread.id, agentId, {
          pollingOptions: {
            intervalInMs: 2000, // Poll every 2 seconds
          },
        });

        if (run.status !== 'completed') {
          throw new Error(`Agent run failed with status: ${run.status}`);
        }

        // Retrieve messages (agent's response)
        const messages = await this.agentsClient.messages.list(thread.id);
        const messagesArray: any[] = [];
        for await (const message of messages) {
          messagesArray.push(message);
        }

        // Find the assistant's response (most recent)
        const assistantMessage = messagesArray.find((m: any) => m.role === 'assistant');
        if (!assistantMessage) {
          throw new Error('No assistant response found');
        }

        // Extract text content
        const content = this.extractContentFromMessage(assistantMessage);

        this.logger.log(`Successfully generated content with ${agentName}`);
        return content;
      } finally {
        // Always clean up the thread
        try {
          await this.agentsClient.threads.delete(thread.id);
          this.logger.debug(`Deleted thread ${thread.id}`);
        } catch (deleteError) {
          this.logger.warn(`Failed to delete thread ${thread.id}`, deleteError);
        }
      }
    } catch (error: any) {
      this.logger.error(`${agentName} call failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Extract text content from Azure AI Agents message
   */
  private extractContentFromMessage(message: any): string {
    if (!message.content || !Array.isArray(message.content)) {
      return '';
    }

    // Extract all text content from the message
    const textParts: string[] = [];
    for (const content of message.content) {
      if (content.type === 'text' && 'text' in content && content.text?.value) {
        textParts.push(content.text.value);
      }
    }

    return textParts.join('\n');
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
   * Checks the prompt header first for explicit "Resume Generation" or "CV Generation"
   * Falls back to keyword detection if no clear header is found
   */
  private isResumePrompt(prompt: string): boolean {
    const lowerPrompt = prompt.toLowerCase();
    const firstLine = lowerPrompt.split('\n')[0];

    // Check for explicit resume/CV generation prompt header
    if (firstLine.includes('resume generation') || firstLine.includes('cv generation')) {
      return true;
    }

    // Fallback: keyword detection (avoid false positives)
    const resumeKeywords = ['curriculum vitae', 'ats-optimized resume', 'professional resume'];

    return resumeKeywords.some((keyword) => lowerPrompt.includes(keyword));
  }

  /**
   * Detect if the prompt is for cover letter generation
   * Checks the prompt header first for explicit "Cover Letter Generation"
   * Falls back to keyword detection if no clear header is found
   */
  private isCoverLetterPrompt(prompt: string): boolean {
    const lowerPrompt = prompt.toLowerCase();
    const firstLine = lowerPrompt.split('\n')[0];

    // Check for explicit cover letter generation prompt header
    if (
      firstLine.includes('cover letter generation') ||
      firstLine.includes('motivation letter generation')
    ) {
      return true;
    }

    // Fallback: keyword detection
    const coverLetterKeywords = ['cover letter', 'motivation letter', 'application letter'];

    return coverLetterKeywords.some((keyword) => lowerPrompt.includes(keyword));
  }

  /**
   * Health check for Azure AI Foundry provider
   * Checks agent client availability and fallback configuration
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Check if agents client is available
      if (this.agentsClient && this.cvWriterAgentId && this.clWriterAgentId) {
        this.logger.debug('Azure AI Foundry health check: Agents available');
        return true;
      }

      // Check fallback configuration
      if (this.azureOpenAIEndpoint && this.azureOpenAIApiKey) {
        this.logger.debug('Azure AI Foundry health check: Fallback to Azure OpenAI available');
        return true;
      }

      this.logger.warn('Azure AI Foundry health check failed: No agents or fallback configured');
      return false;
    } catch (error: any) {
      this.logger.warn(`Azure AI Foundry health check failed: ${error.message}`);
      return false;
    }
  }
}
