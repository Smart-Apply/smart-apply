import { Injectable, Logger } from '@nestjs/common';
import { AgentsClient } from '@azure/ai-agents';
import { DefaultAzureCredential } from '@azure/identity';
import { ConfigService } from '../../config/config.service';
import { Agent, ATSAgentInput, ATSAgentOutput } from '../agents.interface';

/**
 * ATS Keyword Extraction Agent
 *
 * Uses Azure AI Foundry Agent to extract structured keywords from job postings.
 * Agent ID: asst_Jn2tlDlX3ZhzVIQhhw5Qa57W
 *
 * Input: Job posting data (title, company, description, requirements, etc.)
 * Output: Structured keywords categorized by type
 */
@Injectable()
export class ATSKeywordAgent implements Agent<ATSAgentInput, ATSAgentOutput> {
  private readonly logger = new Logger(ATSKeywordAgent.name);
  private agentsClient: AgentsClient | null = null;
  private readonly agentId: string;
  private readonly projectEndpoint: string;
  private initialized = false;

  constructor(private readonly configService: ConfigService) {
    this.projectEndpoint = process.env.PROJECT_ENDPOINT || '';
    this.agentId = process.env.ATS_AGENT_ID || 'asst_Jn2tlDlX3ZhzVIQhhw5Qa57W';

    if (!this.projectEndpoint) {
      this.logger.warn('PROJECT_ENDPOINT not configured. ATS Agent will not be available.');
    }
  }

  getName(): string {
    return 'ATS Keyword Agent';
  }

  /**
   * Initialize the Azure AI Agents client
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    if (!this.projectEndpoint) {
      throw new Error('PROJECT_ENDPOINT not configured');
    }

    try {
      this.agentsClient = new AgentsClient(this.projectEndpoint, new DefaultAzureCredential());
      this.initialized = true;
      this.logger.log('ATS Keyword Agent initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize ATS Keyword Agent', error);
      throw error;
    }
  }

  /**
   * Execute keyword extraction on a job posting
   */
  async execute(input: ATSAgentInput): Promise<ATSAgentOutput> {
    this.logger.log(
      `Extracting keywords for: ${input.jobPosting.title} at ${input.jobPosting.company}`,
    );

    // Ensure client is initialized
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.agentsClient) {
      throw new Error('ATS Agent client not initialized');
    }

    // Create thread for this extraction
    const thread = await this.agentsClient.threads.create();
    this.logger.debug(`Created thread ${thread.id} for ATS extraction`);

    try {
      // Send the job posting as a JSON message
      const messageContent = JSON.stringify(input, null, 2);
      await this.agentsClient.messages.create(thread.id, 'user', messageContent);

      // Run the agent and wait for completion
      const run = await this.agentsClient.runs.createAndPoll(thread.id, this.agentId, {
        pollingOptions: {
          intervalInMs: 1000, // Poll every second
        },
      });

      if (run.status !== 'completed') {
        throw new Error(`ATS Agent run failed with status: ${run.status}`);
      }

      // Get the agent's response
      const messages = await this.agentsClient.messages.list(thread.id);
      const messagesArray: any[] = [];
      for await (const message of messages) {
        messagesArray.push(message);
      }

      // Find the assistant's response
      const assistantMessage = messagesArray.find((m: any) => m.role === 'assistant');
      if (!assistantMessage) {
        throw new Error('No response from ATS Agent');
      }

      // Extract and parse the JSON response
      const responseText = this.extractTextFromMessage(assistantMessage);
      const keywords = this.parseAgentResponse(responseText);

      this.logger.log(`Extracted ${this.countKeywords(keywords)} keywords from job posting`);
      return keywords;
    } finally {
      // Always cleanup the thread
      try {
        await this.agentsClient.threads.delete(thread.id);
        this.logger.debug(`Deleted thread ${thread.id}`);
      } catch (deleteError) {
        this.logger.warn(`Failed to delete thread ${thread.id}`, deleteError);
      }
    }
  }

  /**
   * Extract text content from Azure AI Agents message
   */
  private extractTextFromMessage(message: any): string {
    if (!message.content || !Array.isArray(message.content)) {
      return '';
    }

    const textParts: string[] = [];
    for (const content of message.content) {
      if (content.type === 'text' && 'text' in content && content.text?.value) {
        textParts.push(content.text.value);
      }
    }

    return textParts.join('\n');
  }

  /**
   * Parse the agent's JSON response
   */
  private parseAgentResponse(responseText: string): ATSAgentOutput {
    try {
      // Clean the response - remove any markdown code blocks if present
      let cleanedText = responseText.trim();

      // Remove ```json and ``` if present
      if (cleanedText.startsWith('```json')) {
        cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      const parsed = JSON.parse(cleanedText);

      // Backward compatibility: Support both old field names (technicalSkills, toolsAndTechnologies)
      // and new field names (coreCompetencies, methodologies)
      const coreCompetencies = Array.isArray(parsed.coreCompetencies)
        ? parsed.coreCompetencies
        : Array.isArray(parsed.technicalSkills)
          ? parsed.technicalSkills
          : [];

      const methodologies = Array.isArray(parsed.methodologies)
        ? parsed.methodologies
        : Array.isArray(parsed.toolsAndTechnologies)
          ? parsed.toolsAndTechnologies
          : [];

      // Validate and return with defaults for any missing arrays
      return {
        coreCompetencies,
        softSkills: Array.isArray(parsed.softSkills) ? parsed.softSkills : [],
        responsibilityKeywords: Array.isArray(parsed.responsibilityKeywords)
          ? parsed.responsibilityKeywords
          : [],
        requirementKeywords: Array.isArray(parsed.requirementKeywords)
          ? parsed.requirementKeywords
          : [],
        methodologies,
        industryKeywords: Array.isArray(parsed.industryKeywords) ? parsed.industryKeywords : [],
        senioritySignals: Array.isArray(parsed.senioritySignals) ? parsed.senioritySignals : [],
        miscKeywords: Array.isArray(parsed.miscKeywords) ? parsed.miscKeywords : [],
      };
    } catch (error) {
      this.logger.error('Failed to parse ATS Agent response', { responseText, error });
      throw new Error(`Failed to parse ATS Agent response: ${error.message}`);
    }
  }

  /**
   * Count total keywords across all categories
   */
  private countKeywords(keywords: ATSAgentOutput): number {
    return (
      keywords.coreCompetencies.length +
      keywords.softSkills.length +
      keywords.responsibilityKeywords.length +
      keywords.requirementKeywords.length +
      keywords.methodologies.length +
      keywords.industryKeywords.length +
      keywords.senioritySignals.length +
      keywords.miscKeywords.length
    );
  }
}
