import { Injectable, Logger } from '@nestjs/common';
import { AgentsClient } from '@azure/ai-agents';
import { DefaultAzureCredential } from '@azure/identity';
import { ConfigService } from '../../config/config.service';
import { Agent, CLAgentInput, CLAgentOutput, ProfileData } from '../agents.interface';

/**
 * Cover Letter Writer Agent
 *
 * Uses Azure AI Foundry Agent to generate personalized cover letters
 * based on extracted keywords and profile data.
 *
 * Input: Keywords from ATS Agent + Profile data + Job posting info
 * Output: Personalized cover letter with keyword integration
 */
@Injectable()
export class CLWriterAgent implements Agent<CLAgentInput, CLAgentOutput> {
  private readonly logger = new Logger(CLWriterAgent.name);
  private agentsClient: AgentsClient | null = null;
  private readonly agentId: string;
  private readonly projectEndpoint: string;
  private initialized = false;

  constructor(private readonly configService: ConfigService) {
    this.projectEndpoint = process.env.PROJECT_ENDPOINT || '';
    this.agentId = process.env.CL_WRITER_AGENT_ID || '';

    if (!this.projectEndpoint) {
      this.logger.warn('PROJECT_ENDPOINT not configured. CL Writer Agent will not be available.');
    }
    if (!this.agentId) {
      this.logger.warn('CL_WRITER_AGENT_ID not configured. CL Writer Agent will not be available.');
    }
  }

  getName(): string {
    return 'Cover Letter Writer Agent';
  }

  /**
   * Initialize the Azure AI Agents client
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    if (!this.projectEndpoint || !this.agentId) {
      throw new Error(
        'CL Writer Agent not configured (missing PROJECT_ENDPOINT or CL_WRITER_AGENT_ID)',
      );
    }

    try {
      this.agentsClient = new AgentsClient(this.projectEndpoint, new DefaultAzureCredential());
      this.initialized = true;
      this.logger.log('Cover Letter Writer Agent initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize CL Writer Agent', error);
      throw error;
    }
  }

  /**
   * Execute cover letter generation with keyword optimization
   */
  async execute(input: CLAgentInput): Promise<CLAgentOutput> {
    this.logger.log(
      `Generating cover letter for: ${input.jobPosting.title} at ${input.jobPosting.company}`,
    );

    // Ensure client is initialized
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.agentsClient) {
      throw new Error('CL Writer Agent client not initialized');
    }

    // Build the prompt for the agent
    const prompt = this.buildPrompt(input);

    // Create thread for this generation
    const thread = await this.agentsClient.threads.create();
    this.logger.debug(`Created thread ${thread.id} for cover letter generation`);

    try {
      // Send the prompt
      await this.agentsClient.messages.create(thread.id, 'user', prompt);

      // Run the agent and wait for completion
      const run = await this.agentsClient.runs.createAndPoll(thread.id, this.agentId, {
        pollingOptions: {
          intervalInMs: 2000,
        },
      });

      if (run.status !== 'completed') {
        throw new Error(`CL Writer Agent run failed with status: ${run.status}`);
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
        throw new Error('No response from CL Writer Agent');
      }

      // Extract and parse the response
      const responseText = this.extractTextFromMessage(assistantMessage);
      const clOutput = this.parseAgentResponse(responseText, input);

      this.logger.log(
        `Generated cover letter with ${clOutput.keyHighlights.length} key highlights`,
      );
      return clOutput;
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
   * Build the prompt for the CL Writer Agent
   */
  private buildPrompt(input: CLAgentInput): string {
    const { keywords, profile, jobPosting, language } = input;

    return `
# Cover Letter Generation Request

## Target Position
- **Title:** ${jobPosting.title}
- **Company:** ${jobPosting.company}

## Job Posting Full Text
${jobPosting.fullText}

## Extracted Keywords from Job Posting
${JSON.stringify(keywords, null, 2)}

## Candidate Profile
${JSON.stringify(this.sanitizeProfile(profile), null, 2)}

## Instructions
Generate a compelling, personalized cover letter by:
1. Opening with a strong hook that connects candidate's experience to the role
2. Highlighting 3-5 key achievements that match job requirements
3. Incorporating relevant keywords naturally (not forced)
4. Showing genuine interest in the company and role
5. Closing with a confident call-to-action

## Style Guidelines
- Professional but personable tone
- Concise (max 400 words)
- Focus on value the candidate brings
- Avoid generic phrases like "I am writing to apply"
- Show don't tell - use specific examples

## Language Detection (CRITICAL)
**ANALYZE the Job Posting Full Text above and determine its language:**
- If the job posting is written in German → Write the cover letter in German
- If the job posting is written in English → Write the cover letter in English
- If the job posting is written in any other language → Write the cover letter in that language

**DO NOT use the provided language hint (${language}) if it conflicts with the actual job posting language.**
**The job posting language ALWAYS takes priority over any hint.**

## Output Format (JSON)
Return a JSON object with:
{
  "coverLetter": "Full cover letter text with proper formatting (use \\n for paragraphs)",
  "keyHighlights": [
    "Highlight 1 - brief description of key point made",
    "Highlight 2",
    "Highlight 3"
  ],
  "keywordUsage": [
    {
      "keyword": "JavaScript",
      "category": "technical",
      "found": true,
      "usedIn": ["cover-letter"],
      "confidence": 0.9
    }
  ],
  "tone": "formal" | "semi-formal" | "casual"
}

Return ONLY the JSON object.
`;
  }

  /**
   * Sanitize profile data for the prompt
   */
  private sanitizeProfile(profile: ProfileData): any {
    return {
      name: `${profile.firstName} ${profile.lastName}`,
      summary: profile.summary,
      topSkills: profile.skills.slice(0, 10).map((s) => s.name),
      recentExperiences: profile.experiences.slice(0, 3).map((e) => ({
        title: e.title,
        company: e.company,
        highlights: e.description,
      })),
      education: profile.education.slice(0, 2).map((e) => ({
        degree: e.degree,
        institution: e.institution,
      })),
      certificates: profile.certificates.slice(0, 3).map((c) => c.name),
      languages: profile.languages.map((l) => `${l.name} (${l.level})`),
    };
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
  private parseAgentResponse(responseText: string, input: CLAgentInput): CLAgentOutput {
    try {
      // Clean the response
      let cleanedText = responseText.trim();
      if (cleanedText.startsWith('```json')) {
        cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      const parsed = JSON.parse(cleanedText);

      // Validate and return with defaults
      return {
        coverLetter: parsed.coverLetter || '',
        keyHighlights: Array.isArray(parsed.keyHighlights) ? parsed.keyHighlights : [],
        keywordUsage: Array.isArray(parsed.keywordUsage) ? parsed.keywordUsage : [],
        tone: this.validateTone(parsed.tone),
      };
    } catch (error) {
      this.logger.error('Failed to parse CL Writer Agent response', { responseText, error });

      // If parsing fails, the response might be the cover letter directly
      return this.generateFallbackResponse(responseText, input);
    }
  }

  /**
   * Validate and normalize tone
   */
  private validateTone(tone: any): 'formal' | 'semi-formal' | 'casual' {
    if (tone === 'formal' || tone === 'semi-formal' || tone === 'casual') {
      return tone;
    }
    return 'semi-formal';
  }

  /**
   * Generate fallback response if parsing fails
   */
  private generateFallbackResponse(responseText: string, input: CLAgentInput): CLAgentOutput {
    const { keywords, profile, jobPosting, language } = input;

    // If the response is plain text, use it as the cover letter
    const coverLetter = responseText.includes('{')
      ? this.generateSimpleCoverLetter(profile, jobPosting, language)
      : responseText;

    return {
      coverLetter,
      keyHighlights: [
        `Experience as ${profile.experiences[0]?.title || 'Professional'}`,
        `Skills in ${profile.skills
          .slice(0, 3)
          .map((s) => s.name)
          .join(', ')}`,
        `Motivated to join ${jobPosting.company}`,
      ],
      keywordUsage: keywords.coreCompetencies.slice(0, 5).map((k) => ({
        keyword: k,
        category: 'core' as const,
        found: coverLetter.toLowerCase().includes(k.toLowerCase()),
        usedIn: ['cover-letter'] as const,
        confidence: 0.7,
      })),
      tone: 'semi-formal',
    };
  }

  /**
   * Generate a simple cover letter as fallback
   */
  private generateSimpleCoverLetter(
    profile: ProfileData,
    jobPosting: { title: string; company: string; fullText: string },
    language: 'de' | 'en',
  ): string {
    const name = `${profile.firstName} ${profile.lastName}`;
    const recentJob = profile.experiences[0];
    const topSkills = profile.skills
      .slice(0, 5)
      .map((s) => s.name)
      .join(', ');

    if (language === 'de') {
      return `Sehr geehrte Damen und Herren,

mit großem Interesse habe ich Ihre Stellenausschreibung als ${jobPosting.title} bei ${jobPosting.company} gelesen.

${recentJob ? `Als ${recentJob.title} bei ${recentJob.company} habe ich umfangreiche Erfahrung in ${topSkills} gesammelt.` : `Mit meiner Expertise in ${topSkills} bringe ich die erforderlichen Fähigkeiten für diese Position mit.`}

${profile.summary || 'Ich bin motiviert, meine Fähigkeiten in Ihrem Unternehmen einzubringen und weiterzuentwickeln.'}

Ich freue mich auf ein persönliches Gespräch.

Mit freundlichen Grüßen
${name}`;
    }

    return `Dear Hiring Manager,

I am excited to apply for the ${jobPosting.title} position at ${jobPosting.company}.

${recentJob ? `As a ${recentJob.title} at ${recentJob.company}, I have developed strong expertise in ${topSkills}.` : `With my expertise in ${topSkills}, I am confident I can contribute effectively to your team.`}

${profile.summary || 'I am eager to bring my skills and experience to your organization and grow professionally.'}

I look forward to discussing how I can contribute to your team.

Best regards,
${name}`;
  }
}
