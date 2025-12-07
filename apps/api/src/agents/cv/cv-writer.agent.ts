import { Injectable, Logger } from '@nestjs/common';
import { AgentsClient } from '@azure/ai-agents';
import { DefaultAzureCredential } from '@azure/identity';
import { ConfigService } from '../../config/config.service';
import { Agent, CVAgentInput, CVAgentOutput, ProfileData } from '../agents.interface';

/**
 * CV Writer Agent
 *
 * Uses Azure AI Foundry Agent to generate optimized resume content
 * based on extracted keywords and profile data.
 *
 * Input: Keywords from ATS Agent + Profile data + Job posting info
 * Output: Optimized CV content with selected skills, experiences, and match analysis
 */
@Injectable()
export class CVWriterAgent implements Agent<CVAgentInput, CVAgentOutput> {
  private readonly logger = new Logger(CVWriterAgent.name);
  private agentsClient: AgentsClient | null = null;
  private readonly agentId: string;
  private readonly projectEndpoint: string;
  private initialized = false;

  constructor(private readonly configService: ConfigService) {
    this.projectEndpoint = process.env.PROJECT_ENDPOINT || '';
    this.agentId = process.env.CV_WRITER_AGENT_ID || '';

    if (!this.projectEndpoint) {
      this.logger.warn('PROJECT_ENDPOINT not configured. CV Writer Agent will not be available.');
    }
    if (!this.agentId) {
      this.logger.warn('CV_WRITER_AGENT_ID not configured. CV Writer Agent will not be available.');
    }
  }

  getName(): string {
    return 'CV Writer Agent';
  }

  /**
   * Initialize the Azure AI Agents client
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    if (!this.projectEndpoint || !this.agentId) {
      throw new Error(
        'CV Writer Agent not configured (missing PROJECT_ENDPOINT or CV_WRITER_AGENT_ID)',
      );
    }

    try {
      this.agentsClient = new AgentsClient(this.projectEndpoint, new DefaultAzureCredential());
      this.initialized = true;
      this.logger.log('CV Writer Agent initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize CV Writer Agent', error);
      throw error;
    }
  }

  /**
   * Execute CV generation with keyword optimization
   */
  async execute(input: CVAgentInput): Promise<CVAgentOutput> {
    this.logger.log(
      `Generating optimized CV for: ${input.jobPosting.title} at ${input.jobPosting.company}`,
    );

    // Ensure client is initialized
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.agentsClient) {
      throw new Error('CV Writer Agent client not initialized');
    }

    // Build the prompt for the agent
    const prompt = this.buildPrompt(input);

    // Create thread for this generation
    const thread = await this.agentsClient.threads.create();
    this.logger.debug(`Created thread ${thread.id} for CV generation`);

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
        throw new Error(`CV Writer Agent run failed with status: ${run.status}`);
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
        throw new Error('No response from CV Writer Agent');
      }

      // Extract and parse the response
      const responseText = this.extractTextFromMessage(assistantMessage);
      const cvOutput = this.parseAgentResponse(responseText, input);

      this.logger.log(`Generated CV with ${cvOutput.matchScore}% match score`);
      return cvOutput;
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
   * Build the prompt for the CV Writer Agent
   */
  private buildPrompt(input: CVAgentInput): string {
    const { keywords, profile, jobPosting, language } = input;

    return `
# CV Generation Request

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
Generate an ATS-optimized resume by:
1. Selecting the most relevant skills that match the extracted keywords
2. Prioritizing experiences that demonstrate required competencies
3. Highlighting projects that showcase relevant technologies
4. Including education and certifications that match requirements

## Language Detection (CRITICAL)
**ANALYZE the Job Posting Full Text above and determine its language:**
- If the job posting is written in German → Write the CV in German
- If the job posting is written in English → Write the CV in English
- If the job posting is written in any other language → Write the CV in that language

**DO NOT use the provided language hint (${language}) if it conflicts with the actual job posting language.**
**The job posting language ALWAYS takes priority over any hint.**

## Output Format (JSON)
Return a JSON object with:
{
  "summary": "2-3 sentence professional summary highlighting key qualifications",
  "selectedSkills": [
    {
      "name": "Skill Name",
      "level": "Expert|Advanced|Intermediate",
      "relevanceScore": 0.0-1.0,
      "matchedKeywords": ["keyword1", "keyword2"]
    }
  ],
  "selectedExperiences": [
    {
      "title": "Job Title",
      "company": "Company Name",
      "duration": "Jan 2020 - Present",
      "highlights": ["Achievement 1", "Achievement 2"],
      "relevanceScore": 0.0-1.0,
      "matchedKeywords": ["keyword1"]
    }
  ],
  "selectedProjects": [
    {
      "name": "Project Name",
      "description": "Brief description",
      "technologies": ["Tech1", "Tech2"],
      "relevanceScore": 0.0-1.0,
      "matchedKeywords": ["keyword1"]
    }
  ],
  "selectedEducation": [
    {
      "degree": "Degree Name",
      "institution": "Institution Name",
      "fieldOfStudy": "Field",
      "relevanceScore": 0.0-1.0
    }
  ],
  "selectedCertificates": ["Cert1", "Cert2"],
  "keywordMatches": [
    {
      "keyword": "JavaScript",
      "category": "technical",
      "found": true,
      "usedIn": ["skills", "experience"],
      "confidence": 0.95
    }
  ],
  "matchScore": 75
}

Return ONLY the JSON object.
`;
  }

  /**
   * Sanitize profile data for the prompt (remove sensitive info, simplify)
   */
  private sanitizeProfile(profile: ProfileData): any {
    return {
      name: `${profile.firstName} ${profile.lastName}`,
      summary: profile.summary,
      skills: profile.skills.map((s) => ({ name: s.name, level: s.level })),
      experiences: profile.experiences.map((e) => ({
        title: e.title,
        company: e.company,
        duration: this.formatDuration(e.startDate, e.endDate, e.current),
        description: e.description,
      })),
      education: profile.education.map((e) => ({
        degree: e.degree,
        institution: e.institution,
        fieldOfStudy: e.fieldOfStudy,
      })),
      certificates: profile.certificates.map((c) => c.name),
      projects: profile.projects.map((p) => ({
        name: p.name,
        description: p.description,
        technologies: p.technologies,
      })),
      languages: profile.languages.map((l) => ({ name: l.name, level: l.level })),
    };
  }

  /**
   * Format duration string from dates
   */
  private formatDuration(startDate: Date, endDate?: Date, current?: boolean): string {
    const start = new Date(startDate);
    const startStr = start.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

    if (current) {
      return `${startStr} - Present`;
    }

    if (endDate) {
      const end = new Date(endDate);
      const endStr = end.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      return `${startStr} - ${endStr}`;
    }

    return startStr;
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
  private parseAgentResponse(responseText: string, input: CVAgentInput): CVAgentOutput {
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
        summary: parsed.summary || '',
        selectedSkills: Array.isArray(parsed.selectedSkills) ? parsed.selectedSkills : [],
        selectedExperiences: Array.isArray(parsed.selectedExperiences)
          ? parsed.selectedExperiences
          : [],
        selectedProjects: Array.isArray(parsed.selectedProjects) ? parsed.selectedProjects : [],
        selectedEducation: Array.isArray(parsed.selectedEducation) ? parsed.selectedEducation : [],
        selectedCertificates: Array.isArray(parsed.selectedCertificates)
          ? parsed.selectedCertificates
          : [],
        keywordMatches: Array.isArray(parsed.keywordMatches) ? parsed.keywordMatches : [],
        matchScore: typeof parsed.matchScore === 'number' ? parsed.matchScore : 0,
      };
    } catch (error) {
      this.logger.error('Failed to parse CV Writer Agent response', { responseText, error });

      // Return a fallback response based on input profile
      return this.generateFallbackResponse(input);
    }
  }

  /**
   * Generate fallback response if agent fails
   */
  private generateFallbackResponse(input: CVAgentInput): CVAgentOutput {
    const { profile, keywords } = input;

    // Simple keyword matching for fallback
    const technicalKeywords = new Set([
      ...keywords.coreCompetencies.map((k) => k.toLowerCase()),
      ...keywords.methodologies.map((k) => k.toLowerCase()),
    ]);

    const matchedSkills = profile.skills.filter((s) => technicalKeywords.has(s.name.toLowerCase()));

    return {
      summary: profile.summary || '',
      selectedSkills: matchedSkills.map((s) => ({
        name: s.name,
        level: s.level,
        relevanceScore: 0.8,
        matchedKeywords: [s.name],
      })),
      selectedExperiences: profile.experiences.slice(0, 3).map((e) => ({
        title: e.title,
        company: e.company,
        duration: this.formatDuration(e.startDate, e.endDate, e.current),
        highlights: e.description ? [e.description] : [],
        relevanceScore: 0.7,
        matchedKeywords: [],
      })),
      selectedProjects: profile.projects.slice(0, 2).map((p) => ({
        name: p.name,
        description: p.description || '',
        technologies: p.technologies,
        relevanceScore: 0.6,
        matchedKeywords: p.technologies.filter((t) => technicalKeywords.has(t.toLowerCase())),
      })),
      selectedEducation: profile.education.map((e) => ({
        degree: e.degree,
        institution: e.institution,
        fieldOfStudy: e.fieldOfStudy,
        relevanceScore: 0.5,
      })),
      selectedCertificates: profile.certificates.map((c) => c.name),
      keywordMatches: [],
      matchScore: Math.round((matchedSkills.length / Math.max(technicalKeywords.size, 1)) * 100),
    };
  }
}
