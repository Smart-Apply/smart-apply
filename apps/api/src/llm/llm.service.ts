import { Injectable, Inject, Logger, ServiceUnavailableException } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as CircuitBreaker from 'opossum';
import { LLMProvider } from './llm.interface';
import { ConfigService } from '../config/config.service';
import { stripClosingPhrase } from '../common/services/html-sanitizer';

@Injectable()
export class LLMService {
  private readonly logger = new Logger(LLMService.name);
  private readonly circuitBreaker: CircuitBreaker<[string, any?], string>;

  constructor(
    @Inject('LLM_PROVIDER')
    private readonly provider: LLMProvider,
    private readonly configService: ConfigService,
  ) {
    // Initialize circuit breaker for LLM provider calls
    this.circuitBreaker = new CircuitBreaker(
      async (prompt: string, options?: any) => await this.provider.generateText(prompt, options),
      {
        timeout: this.configService.llmCircuitBreakerTimeout, // 60s timeout
        errorThresholdPercentage: this.configService.llmCircuitBreakerErrorThreshold, // Open if 50% fail
        resetTimeout: this.configService.llmCircuitBreakerResetTimeout, // Try again after 30s
        rollingCountTimeout: this.configService.llmCircuitBreakerRollingCountTimeout, // 10s window
        rollingCountBuckets: this.configService.llmCircuitBreakerRollingCountBuckets, // 10 buckets
        name: 'LLM-Provider', // Circuit breaker name for logging
      },
    );

    // Circuit breaker event handlers
    this.circuitBreaker.on('open', () => {
      this.logger.error(
        '🔴 Circuit breaker OPEN - LLM provider is failing. All requests will fast-fail until recovery.',
      );
    });

    this.circuitBreaker.on('halfOpen', () => {
      this.logger.warn(
        '🟡 Circuit breaker HALF-OPEN - Testing LLM provider health with single request.',
      );
    });

    this.circuitBreaker.on('close', () => {
      this.logger.log('🟢 Circuit breaker CLOSED - LLM provider recovered and accepting requests.');
    });

    this.circuitBreaker.on('timeout', () => {
      this.logger.warn(
        `⏱️  LLM request timeout after ${this.configService.llmCircuitBreakerTimeout}ms`,
      );
    });

    this.circuitBreaker.on('fallback', (result) => {
      this.logger.warn('🔄 Circuit breaker fallback triggered');
    });

    this.circuitBreaker.on('reject', () => {
      this.logger.warn('⛔ Circuit breaker rejected request (circuit is open)');
    });

    this.logger.log(
      `🛡️  LLM Circuit Breaker initialized (timeout: ${this.configService.llmCircuitBreakerTimeout}ms, error threshold: ${this.configService.llmCircuitBreakerErrorThreshold}%, reset: ${this.configService.llmCircuitBreakerResetTimeout}ms)`,
    );
  }

  /**
   * Health check for the LLM service
   * Checks circuit breaker state and provider health
   * @returns true if the service is healthy, false otherwise
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Check circuit breaker state
      const circuitState = this.circuitBreaker.status.stats;
      const isCircuitOpen = this.circuitBreaker.opened;

      if (isCircuitOpen) {
        this.logger.warn('LLM health check: Circuit breaker is OPEN');
        return false;
      }

      // Check provider health if the method exists
      if (typeof this.provider.healthCheck === 'function') {
        const providerHealth = await this.provider.healthCheck();
        if (!providerHealth) {
          this.logger.warn('LLM health check: Provider health check failed');
          return false;
        }
      }

      this.logger.debug('LLM health check: OK');
      return true;
    } catch (error: any) {
      this.logger.error(`LLM health check failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Call LLM provider with circuit breaker protection
   * Wraps provider.generateText() with timeout and automatic failover
   */
  private async callProvider(prompt: string, options?: any): Promise<string> {
    try {
      return await this.circuitBreaker.fire(prompt, options);
    } catch (error: any) {
      // Circuit breaker is open (too many failures)
      if (error.message && error.message.includes('Breaker is open')) {
        this.logger.error('Circuit breaker is open - LLM service temporarily unavailable');
        throw new ServiceUnavailableException(
          'AI-Service ist derzeit überlastet. Deine Bewerbung wurde in die Warteschlange gestellt und wird in Kürze verarbeitet. Bitte versuche es in ein paar Minuten erneut.',
        );
      }

      // Timeout error
      if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
        this.logger.error('LLM request timeout');
        throw new ServiceUnavailableException(
          'AI-Service antwortet nicht rechtzeitig. Bitte versuche es später erneut.',
        );
      }

      // Other errors - rethrow
      throw error;
    }
  }

  /**
   * Detect the language of the provided text content
   * Uses simple heuristics based on common words and patterns
   * Returns 'en' or 'de' (defaults to 'en' if uncertain)
   */
  private detectContentLanguage(text: string): 'en' | 'de' {
    if (!text || text.trim().length === 0) return 'en';

    // Strip HTML tags for analysis
    const plainText = text.replace(/<[^>]+>/g, ' ').toLowerCase();

    // German-specific words and patterns
    const germanPatterns = [
      /\b(und|oder|der|die|das|für|mit|bei|auf|aus|von|zu|im|ist|sind|wurde|wurden|als|auch|nach)\b/gi,
      /\b(entwickelt|implementiert|führte|optimiert|erstellt|koordiniert|verbessert|reduziert|steigerte)\b/gi,
      /\b(erfahrung|projekt|entwicklung|umsetzung|verantwortlich|erfolgreich|prozess|system)\b/gi,
      /[äöüß]/gi,
    ];

    // English-specific words and patterns
    const englishPatterns = [
      /\b(the|and|or|for|with|from|was|were|has|have|been|into|this|that|which)\b/gi,
      /\b(developed|implemented|led|optimized|created|coordinated|improved|reduced|increased)\b/gi,
      /\b(experience|project|development|implementation|responsible|successful|process|system)\b/gi,
    ];

    let germanScore = 0;
    let englishScore = 0;

    for (const pattern of germanPatterns) {
      const matches = plainText.match(pattern);
      if (matches) germanScore += matches.length;
    }

    for (const pattern of englishPatterns) {
      const matches = plainText.match(pattern);
      if (matches) englishScore += matches.length;
    }

    // If German umlauts or ß are present, heavily weight towards German
    if (/[äöüß]/i.test(plainText)) {
      germanScore += 10;
    }

    this.logger.debug(`Language detection: German=${germanScore}, English=${englishScore}`);

    return germanScore > englishScore ? 'de' : 'en';
  }

  async generateCoverLetter(context: CoverLetterContext): Promise<string> {
    const template = await this.loadTemplate('cover-letter.md');
    const prompt = this.renderTemplate(template, context);

    return this.callProvider(prompt, {
      temperature: 0.7,
      maxTokens: 1500,
      systemMessage:
        'You are a professional career coach helping candidates write compelling cover letters.',
    });
  }

  /**
   * Generate ATS-optimized cover letter with strategic keyword placement
   * Uses extracted keywords to optimize content for ATS scanning while maintaining readability
   */
  async generateCoverLetterATS(context: ATSCoverLetterContext): Promise<string> {
    this.logger.log(
      `Generating ATS-optimized cover letter for ${context.jobTitle} at ${context.companyName}`,
    );

    const template = await this.loadTemplate('cover-letter-ats.md');
    const prompt = this.renderTemplate(template, this.buildATSCoverLetterContext(context));

    return this.callProvider(prompt, {
      temperature: 0.7,
      maxTokens: 1500,
      systemMessage:
        'You are an expert ATS-optimization specialist and career coach. You write compelling cover letters that pass Applicant Tracking Systems while remaining engaging for human readers. You strategically place keywords for maximum ATS match rate without sacrificing readability.',
    });
  }

  async generateResume(context: ResumeContext): Promise<string> {
    const template = await this.loadTemplate('resume.md');
    const prompt = this.renderTemplate(template, context);

    return this.callProvider(prompt, {
      temperature: 0.6,
      maxTokens: 2500,
      systemMessage:
        'You are an expert resume writer creating ATS-optimized, professional resumes.',
    });
  }

  /**
   * Generate ATS-optimized resume with strategic keyword placement
   * Uses extracted keywords to optimize content for ATS scanning while maintaining professionalism
   */
  async generateResumeATS(context: ATSResumeContext): Promise<string> {
    this.logger.log(
      `Generating ATS-optimized resume for ${context.jobTitle} at ${context.companyName}`,
    );

    const template = await this.loadTemplate('resume-ats.md');
    const prompt = this.renderTemplate(template, this.buildATSResumeContext(context));

    return this.callProvider(prompt, {
      temperature: 0.6,
      maxTokens: 2500,
      systemMessage:
        'You are an expert ATS-optimization specialist and resume writer. You create professional resumes that pass Applicant Tracking Systems by strategically placing keywords in optimal positions (summary, skills, experience bullets) while maintaining natural, quantified content.',
    });
  }

  /**
   * Generate text directly from a prompt (for custom use cases)
   */
  async generateText(
    prompt: string,
    options?: { temperature?: number; maxTokens?: number; systemMessage?: string },
  ): Promise<string> {
    return this.callProvider(prompt, options);
  }

  /**
   * Translate a profile summary to the target language
   * Used during initial application creation when job language differs from profile language
   *
   * @param summary - Original summary text (typically in German)
   * @param targetLanguage - Target language code (e.g., 'en', 'fr', 'es', 'it')
   * @returns Translated summary
   */
  async translateSummary(summary: string, targetLanguage: string): Promise<string> {
    if (!summary || summary.trim().length === 0) {
      return summary;
    }

    const languageNames: Record<string, string> = {
      de: 'German',
      en: 'English',
      fr: 'French',
      es: 'Spanish',
      it: 'Italian',
    };

    const targetLangName = languageNames[targetLanguage] || 'English';
    const sourceLanguage = this.detectContentLanguage(summary);
    const sourceLangName = languageNames[sourceLanguage] || 'German';

    // Skip if already in target language
    if (sourceLanguage === targetLanguage) {
      return summary;
    }

    this.logger.log(`Translating summary from ${sourceLangName} to ${targetLangName}`);

    const prompt = `Translate the following professional profile summary from ${sourceLangName} to ${targetLangName}.
Keep the professional tone and maintain all specific details, achievements, and metrics.
Do NOT add any introductory text or explanations - only return the translated text.

Original text:
${summary}

Translated text in ${targetLangName}:`;

    const translated = await this.callProvider(prompt, {
      temperature: 0.3,
      maxTokens: 500,
      systemMessage: `You are a professional translator specializing in career documents. Translate accurately while maintaining the professional tone.`,
    });

    return translated.trim();
  }

  /**
   * Call LLM with template and return raw text response
   * Loads template from prompts/ folder, renders variables, and calls LLM
   *
   * @param templatePath - Relative path to template (e.g., "v1/skill-selector.md")
   * @param variables - Variables to inject into template (supports {{json variable}} for JSON serialization)
   * @param options - Optional LLM generation options
   * @returns Raw text response from LLM
   */
  async callText(
    templatePath: string,
    variables: Record<string, any>,
    options?: { temperature?: number; maxTokens?: number; systemMessage?: string },
  ): Promise<string> {
    const startTime = Date.now();
    const template = await this.loadTemplate(templatePath);
    const prompt = this.renderTemplate(template, variables);

    const shouldLog = process.env.LOG_LLM_CALLS === 'true';
    if (shouldLog) {
      this.logger.log(`LLM callText: ${templatePath}`, {
        templatePath,
        userId: variables.userId || 'unknown',
        jobPostingId: variables.jobPostingId || 'unknown',
      });
    }

    const defaultOptions = {
      temperature: 0.5,
      maxTokens: 3000,
      ...options,
    };

    try {
      let response = await this.callProvider(prompt, defaultOptions);
      const duration = Date.now() - startTime;

      // Post-process to remove LLM placeholder patterns (e.g., "[Your Name]")
      response = this.stripLLMPlaceholders(response);

      if (shouldLog) {
        this.logger.log(`LLM callText completed: ${templatePath} (${duration}ms)`);
      }

      return response;
    } catch (error) {
      this.logger.error(`LLM callText failed: ${templatePath}`, error);
      throw error;
    }
  }

  /**
   * Call LLM with template and return parsed JSON response
   * Enforces structured JSON output with error recovery
   *
   * @param templatePath - Relative path to template (e.g., "v1/ats-keywords.md")
   * @param variables - Variables to inject into template
   * @param options - Optional LLM generation options
   * @returns Parsed JSON object of type T
   * @throws Error if JSON parsing fails after recovery attempts
   */
  async callJson<T>(
    templatePath: string,
    variables: Record<string, any>,
    options?: { temperature?: number; maxTokens?: number; systemMessage?: string },
  ): Promise<T> {
    const startTime = Date.now();
    const template = await this.loadTemplate(templatePath);
    const prompt = this.renderTemplate(template, variables);

    const shouldLog = process.env.LOG_LLM_CALLS === 'true';
    if (shouldLog) {
      this.logger.log(`LLM callJson: ${templatePath}`, {
        templatePath,
        userId: variables.userId || 'unknown',
        jobPostingId: variables.jobPostingId || 'unknown',
      });
    }

    const defaultOptions = {
      temperature: 0.5,
      maxTokens: 3000,
      ...options,
    };

    try {
      const response = await this.callProvider(prompt, defaultOptions);
      const parsed = this.parseJsonResponse<T>(response, templatePath);
      const duration = Date.now() - startTime;

      if (shouldLog) {
        this.logger.log(`LLM callJson completed: ${templatePath} (${duration}ms)`);
      }

      return parsed;
    } catch (error) {
      this.logger.error(`LLM callJson failed: ${templatePath}`, error);
      throw error;
    }
  }

  /**
   * Parse JSON response from LLM with error recovery
   * Handles common LLM output issues like markdown code blocks and trailing text
   */
  private parseJsonResponse<T>(response: string, templatePath: string): T {
    try {
      // Trim whitespace
      let cleaned = response.trim();

      // Remove markdown code blocks (```json ... ``` or ``` ... ```)
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '');
        cleaned = cleaned.replace(/\n?```\s*$/i, '');
        cleaned = cleaned.trim();
      }

      // Try to find JSON object/array if there's extra text
      const jsonMatch = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
      if (jsonMatch) {
        cleaned = jsonMatch[1];
      }

      // Basic trailing comma repair (only for simple cases)
      cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');

      // Parse JSON
      const parsed = JSON.parse(cleaned);

      // Apply validation if template path matches known types
      if (templatePath.includes('skill-selector')) {
        return this.validateTailoredProfile(parsed) as T;
      } else if (templatePath.includes('ats-keywords')) {
        return this.validateAtsKeywords(parsed) as T;
      }

      return parsed as T;
    } catch (error) {
      this.logger.error(
        `Failed to parse LLM JSON response for template: ${templatePath}`,
        error.message,
      );
      this.logger.debug('Raw LLM response:', response.substring(0, 500));
      throw new Error(`Failed to parse LLM JSON response for template: ${templatePath}`);
    }
  }

  /**
   * Validate and fix TailoredProfileDto output from LLM
   * Enforces constraints like max skills, max experiences, etc.
   */
  private validateTailoredProfile(data: any): any {
    if (!data.target_role || !data.target_company) {
      throw new Error(
        'Invalid tailored profile: missing required fields (target_role, target_company)',
      );
    }

    // Ensure all required fields exist with defaults
    const validated = {
      target_role: data.target_role || 'Unknown Role',
      target_company: data.target_company || 'Unknown Company',
      reasoning_short: data.reasoning_short || '',
      selected_hard_skills: Array.isArray(data.selected_hard_skills)
        ? data.selected_hard_skills
        : [],
      selected_soft_skills: Array.isArray(data.selected_soft_skills)
        ? data.selected_soft_skills
        : [],
      selected_tools: Array.isArray(data.selected_tools) ? data.selected_tools : [],
      selected_experiences: Array.isArray(data.selected_experiences)
        ? data.selected_experiences
        : [],
      selected_projects: Array.isArray(data.selected_projects) ? data.selected_projects : [],
      selected_certificates: Array.isArray(data.selected_certificates)
        ? data.selected_certificates
        : [],
      selected_education: Array.isArray(data.selected_education) ? data.selected_education : [],
      selected_languages: Array.isArray(data.selected_languages) ? data.selected_languages : [],
    };

    // Enforce max limits with truncation
    if (validated.selected_hard_skills.length > 12) {
      this.logger.warn(
        `LLM returned ${validated.selected_hard_skills.length} hard skills, truncating to 12`,
      );
      validated.selected_hard_skills = validated.selected_hard_skills.slice(0, 12);
    }

    if (validated.selected_soft_skills.length > 6) {
      this.logger.warn(
        `LLM returned ${validated.selected_soft_skills.length} soft skills, truncating to 6`,
      );
      validated.selected_soft_skills = validated.selected_soft_skills.slice(0, 6);
    }

    if (validated.selected_tools.length > 8) {
      this.logger.warn(`LLM returned ${validated.selected_tools.length} tools, truncating to 8`);
      validated.selected_tools = validated.selected_tools.slice(0, 8);
    }

    if (validated.selected_experiences.length > 5) {
      this.logger.warn(
        `LLM returned ${validated.selected_experiences.length} experiences, truncating to 5`,
      );
      validated.selected_experiences = validated.selected_experiences.slice(0, 5);
    }

    if (validated.selected_projects.length > 5) {
      this.logger.warn(
        `LLM returned ${validated.selected_projects.length} projects, truncating to 5`,
      );
      validated.selected_projects = validated.selected_projects.slice(0, 5);
    }

    return validated;
  }

  /**
   * Validate AtsKeywordsOutputDto from LLM
   * Enforces max 20 keywords total across all categories
   * NOTE: Source field (job/both) is now determined separately by deterministic matching
   * SIMPLIFIED: Only 2 categories now: hard_skills and soft_skills
   */
  private validateAtsKeywords(data: any): any {
    const validated = {
      hard_skills: Array.isArray(data.hard_skills) ? data.hard_skills : [],
      soft_skills: Array.isArray(data.soft_skills) ? data.soft_skills : [],
    };

    // Validate each keyword has required fields (no source field, added later)
    const validateKeyword = (kw: any) => {
      if (!kw.keyword || typeof kw.keyword !== 'string') {
        this.logger.warn(`Invalid keyword object: ${JSON.stringify(kw)}`);
        return null;
      }

      return {
        keyword: kw.keyword.trim(),
        priority: [1, 2, 3].includes(kw.priority) ? kw.priority : 2,
      };
    };

    validated.hard_skills = validated.hard_skills.map(validateKeyword).filter(Boolean);
    validated.soft_skills = validated.soft_skills.map(validateKeyword).filter(Boolean);

    // Count total keywords
    const totalKeywords = validated.hard_skills.length + validated.soft_skills.length;

    // If over 15, truncate by priority (STRICT LIMIT)
    if (totalKeywords > 15) {
      this.logger.warn(`LLM returned ${totalKeywords} keywords, truncating to 15 by priority`);

      // Flatten all keywords with category info
      const allKeywords: Array<{
        keyword: string;
        priority: number;
        category: string;
      }> = [
        ...validated.hard_skills.map((kw) => ({ ...kw, category: 'hard_skills' })),
        ...validated.soft_skills.map((kw) => ({ ...kw, category: 'soft_skills' })),
      ];

      // Sort by priority (1 = highest)
      allKeywords.sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return 0;
      });

      // Take top 15 (STRICT LIMIT)
      const top15 = allKeywords.slice(0, 15);

      // Rebuild categories
      validated.hard_skills = top15.filter((kw) => kw.category === 'hard_skills');
      validated.soft_skills = top15.filter((kw) => kw.category === 'soft_skills');
    }

    return validated;
  }

  /**
   * Intelligently categorize skills based on candidate profile and industry context
   * Uses LLM to create logical, industry-appropriate skill categories
   */
  async categorizeSkills(context: SkillCategorizationContext): Promise<SkillCategory[]> {
    this.logger.log(
      `Categorizing ${context.skills.length} skills for ${context.industry || 'general'} industry`,
    );

    const skillsList = context.skills.join(', ');

    const prompt = `You are an expert career counselor and resume writer. Your task is to intelligently categorize a candidate's skills into logical, industry-appropriate groups.

**Candidate Context:**
${context.candidateContext || 'General professional'}

**Industry/Field:**
${context.industry || 'Not specified - infer from skills'}

**Skills to categorize:**
${skillsList}

**Instructions:**
1. Analyze the skills and candidate background to determine the most appropriate categories
2. Create 3-6 categories that make sense for this specific industry/field
3. Use category names that are relevant to the candidate's profession (NOT just generic tech categories)
4. Group related skills together logically
5. Order categories by relevance (most important skills first)

**Examples of good categorization:**
- IT/Software: "Programming Languages", "Frontend Frameworks", "Cloud & DevOps", "Databases", "Tools"
- Marketing: "Digital Marketing", "Content Creation", "Analytics Tools", "Social Media Platforms", "Design Software"
- Healthcare: "Clinical Skills", "Medical Equipment", "Software Systems", "Administrative", "Certifications"
- Finance: "Financial Analysis", "Software & Tools", "Regulatory Compliance", "Reporting", "Languages"
- General Business: "Core Competencies", "Software & Tools", "Communication", "Project Management"

**Output Format:**
Return ONLY a JSON array in this exact format (no markdown, no additional text):
[
  {
    "type": "Category Name",
    "skills": ["Skill 1", "Skill 2", "Skill 3"]
  },
  {
    "type": "Another Category",
    "skills": ["Skill 4", "Skill 5"]
  }
]

**Rules:**
- Use the EXACT skill names provided (don't modify or translate them)
- Each skill should appear in exactly ONE category
- If a skill doesn't fit elsewhere, create an "Other" or appropriate catch-all category
- Aim for 3-6 categories maximum for clarity
- Return valid JSON only`;

    try {
      const response = await this.callProvider(prompt, {
        temperature: 0.3, // Lower temperature for more consistent categorization
        maxTokens: 1000,
        systemMessage:
          'You are an expert at organizing and categorizing professional skills based on industry context. You return clean JSON output.',
      });

      // Parse LLM response
      const parsed = JSON.parse(response.trim());

      // Validate structure
      if (!Array.isArray(parsed)) {
        throw new Error('LLM response is not an array');
      }

      const categories: SkillCategory[] = parsed
        .map((cat: any) => ({
          type: String(cat.type || 'Other').trim(),
          skills: Array.isArray(cat.skills)
            ? cat.skills.map((s: any) => String(s).trim()).filter(Boolean)
            : [],
        }))
        .filter((cat) => cat.type && cat.skills.length > 0);

      this.logger.log(`Successfully categorized skills into ${categories.length} categories`);
      return categories;
    } catch (error) {
      this.logger.error('Failed to categorize skills with LLM', error);
      // Return a fallback single category
      return [
        {
          type: 'Skills',
          skills: context.skills,
        },
      ];
    }
  }

  /**
   * Modify existing cover letter content based on user instructions
   * Applies AI-based changes to current content while preserving structure
   */
  async modifyCoverLetterContent(
    currentContent: string,
    instructions: string,
    context: { jobTitle: string; companyName: string },
  ): Promise<string> {
    this.logger.log(
      `Modifying cover letter for ${context.jobTitle} at ${context.companyName} with instructions: ${instructions.substring(0, 50)}...`,
    );

    const prompt = `Du bist ein professioneller Karriereberater und hilfst einem Kandidaten, sein Anschreiben zu verbessern.

Aktueller Anschreiben-Inhalt:
${currentContent}

Position: ${context.jobTitle}
Unternehmen: ${context.companyName}

Anweisungen des Kandidaten:
${instructions}

Aufgabe:
1. Wende die gewünschten Änderungen präzise an
2. Behalte die professionelle Struktur und Tonalität bei
3. Halte die Länge ähnlich (nicht wesentlich länger oder kürzer)
4. Bewahre wichtige Erfolge und Erfahrungen, außer sie sollen geändert werden
5. Integriere die Änderungen natürlich in den bestehenden Text
6. Gib NUR das geänderte Anschreiben im Markdown-Format zurück (keine Erklärungen)

Geändertes Anschreiben:`;

    return this.callProvider(prompt, {
      temperature: 0.7,
      maxTokens: 2000,
      systemMessage:
        'Du bist ein Experte im Verfassen und Optimieren von Bewerbungsanschreiben. Du wendest Änderungswünsche präzise an und behältst dabei professionelle Qualität.',
    });
  }

  /**
   * Modify or generate professional summary based on user instructions
   * Tailors summary to job requirements while keeping it concise (3-5 sentences)
   */
  async modifySummaryContent(
    currentSummary: string | undefined,
    instructions: string,
    context: {
      jobTitle: string;
      companyName: string;
      jobDescription?: string;
      skills?: string[];
      experiences?: Array<{ title: string; company: string; description?: string }>;
    },
  ): Promise<string> {
    this.logger.log(
      `Modifying summary for ${context.jobTitle} at ${context.companyName} with instructions: ${instructions.substring(0, 50)}...`,
    );

    // Format skills and experiences for context
    const skillsList = context.skills?.length ? context.skills.join(', ') : 'Keine angegeben';
    const experiencesList = context.experiences?.length
      ? context.experiences
          .map(
            (exp) =>
              `- ${exp.title} bei ${exp.company}${exp.description ? `: ${exp.description.substring(0, 100)}...` : ''}`,
          )
          .join('\n')
      : 'Keine angegeben';

    const hasExistingSummary = currentSummary && currentSummary.trim().length > 0;

    const prompt = `Du bist ein professioneller Karriereberater und hilfst einem Kandidaten, seine berufliche Zusammenfassung für den Lebenslauf zu ${hasExistingSummary ? 'verbessern' : 'erstellen'}.

${
  hasExistingSummary
    ? `Aktuelle Zusammenfassung:
${currentSummary}

`
    : ''
}**Zielposition:** ${context.jobTitle}
**Unternehmen:** ${context.companyName}
${
  context.jobDescription
    ? `**Stellenbeschreibung (Auszug):**
${context.jobDescription.substring(0, 500)}...
`
    : ''
}
**Kandidaten-Skills:** ${skillsList}

**Relevante Berufserfahrung:**
${experiencesList}

**Anweisungen des Kandidaten:**
${instructions}

**Aufgabe:**
1. ${hasExistingSummary ? 'Wende die gewünschten Änderungen präzise an' : 'Erstelle eine neue professionelle Zusammenfassung'}
2. **Halte dich strikt an 3-5 Sätze** (absolutes Maximum)
3. Beginne mit der aktuellen Rolle/Erfahrung und Kernkompetenz
4. Hebe 2-3 relevante Fähigkeiten oder Erfolge hervor, die zur Stelle passen
5. Zeige Motivation für die Zielposition (optional, wenn Platz)
6. Behalte professionellen, selbstbewussten Ton
7. **Gib NUR die Zusammenfassung zurück** (kein Markdown, keine Erklärungen, kein "Zusammenfassung:" Prefix)

Professionelle Zusammenfassung:`;

    return this.callProvider(prompt, {
      temperature: 0.7,
      maxTokens: 500, // Limit output for concise summary
      systemMessage:
        'Du bist ein Experte für Lebenslauf-Optimierung und ATS-konforme Zusammenfassungen. Du schreibst prägnante, wirkungsvolle Zusammenfassungen in 3-5 Sätzen, die relevant für die Zielposition sind.',
    });
  }

  /**
   * Modify or generate experience description using AI
   * Tailors bullet points to job requirements with action verbs and quantifiable achievements
   * Returns HTML formatted bullets for Tiptap editor
   *
   * IMPORTANT: Responds in the same language as the existing content.
   * Only translates if explicitly requested in instructions.
   */
  async modifyExperienceDescription(
    currentDescription: string | undefined,
    instructions: string,
    context: {
      experienceTitle: string;
      experienceCompany: string;
      experienceDateRange?: string;
      jobTitle: string;
      companyName: string;
      jobDescription?: string;
      skills?: string[];
    },
  ): Promise<string> {
    this.logger.log(
      `Modifying experience description for ${context.experienceTitle} at ${context.experienceCompany} with instructions: ${instructions.substring(0, 50)}...`,
    );

    const skillsList = context.skills?.length ? context.skills.join(', ') : 'Not specified';
    const hasExistingDescription = currentDescription && currentDescription.trim().length > 0;

    // Detect language of existing content to maintain consistency
    const contentLanguage = hasExistingDescription
      ? this.detectContentLanguage(currentDescription)
      : 'en'; // Default to English for new content

    const isGerman = contentLanguage === 'de';

    this.logger.log(`Detected content language: ${contentLanguage}`);

    // Language-specific labels
    const labels = isGerman
      ? {
          role: 'Karriereberater',
          action: hasExistingDescription ? 'verbessern' : 'erstellen',
          experience: 'BERUFSERFAHRUNG DIE BEARBEITET WIRD',
          position: 'Position',
          company: 'Unternehmen',
          period: 'Zeitraum',
          currentDesc: 'Aktuelle Beschreibung',
          targetJob: 'ZIELSTELLE (für Relevanz)',
          jobDesc: 'Stellenbeschreibung (Auszug)',
          skills: 'Relevante Skills des Kandidaten',
          userInstructions: 'Anweisungen des Kandidaten',
          rules: 'WICHTIGE REGELN',
          rule1: hasExistingDescription
            ? 'Wende die gewünschten Änderungen präzise an'
            : 'Erstelle 3-5 aussagekräftige Bullet-Points',
          rule2:
            'Jeder Bullet-Point MUSS mit einem starken Aktionsverb beginnen (Entwickelte, Führte, Implementierte, Steigerte, Optimierte, etc.)',
          rule3: 'Quantifiziere Erfolge wo möglich (%, €, Anzahl, Zeit, etc.)',
          rule4: 'Fokussiere auf Erfolge und Impact, nicht nur Aufgaben',
          rule5: 'Priorisiere Punkte nach Relevanz zur Zielstelle',
          rule6: 'Halte jeden Punkt auf 1-2 Zeilen (maximal 20 Wörter pro Punkt)',
          rule7: 'Gib die Antwort als HTML-Aufzählung zurück (KEIN Markdown!)',
          rule8:
            'ANTWORTE AUF DEUTSCH, es sei denn die Anweisungen verlangen explizit eine Übersetzung',
          outputFormat: 'OUTPUT FORMAT (HTML)',
          example1: 'Erster Bullet-Point mit Aktionsverb und messbarem Erfolg',
          important: 'Gib NUR das <ul>...</ul> HTML zurück, keine Erklärungen, kein Markdown!',
          htmlList: 'HTML-Aufzählung',
          systemMsg:
            'Du bist ein Experte für ATS-optimierte Lebensläufe. Du schreibst prägnante, wirkungsvolle Bullet-Points mit Aktionsverben und quantifizierbaren Erfolgen. Antworte auf Deutsch. Gib nur HTML-formatierte Listen zurück, kein Markdown.',
        }
      : {
          role: 'career coach',
          action: hasExistingDescription ? 'improve' : 'create',
          experience: 'WORK EXPERIENCE BEING EDITED',
          position: 'Position',
          company: 'Company',
          period: 'Period',
          currentDesc: 'Current Description',
          targetJob: 'TARGET POSITION (for relevance)',
          jobDesc: 'Job Description (excerpt)',
          skills: "Candidate's relevant skills",
          userInstructions: "User's Instructions",
          rules: 'IMPORTANT RULES',
          rule1: hasExistingDescription
            ? 'Apply the requested changes precisely'
            : 'Create 3-5 impactful bullet points',
          rule2:
            'Each bullet point MUST start with a strong action verb (Developed, Led, Implemented, Increased, Optimized, etc.)',
          rule3: 'Quantify achievements where possible (%, $, numbers, time, etc.)',
          rule4: 'Focus on achievements and impact, not just tasks',
          rule5: 'Prioritize points by relevance to target position',
          rule6: 'Keep each point to 1-2 lines (max 20 words per point)',
          rule7: 'Return the answer as an HTML list (NO Markdown!)',
          rule8: 'RESPOND IN ENGLISH, unless the instructions explicitly request translation',
          outputFormat: 'OUTPUT FORMAT (HTML)',
          example1: 'First bullet point with action verb and measurable achievement',
          important: 'Return ONLY the <ul>...</ul> HTML, no explanations, no Markdown!',
          htmlList: 'HTML List',
          systemMsg:
            'You are an expert in ATS-optimized resumes. You write concise, impactful bullet points with action verbs and quantifiable achievements. Respond in English. Return only HTML-formatted lists, no Markdown.',
        };

    const prompt = `You are a professional ${labels.role} helping a candidate ${labels.action} their work experience description for their resume.

**${labels.experience}:**
- ${labels.position}: ${context.experienceTitle}
- ${labels.company}: ${context.experienceCompany}
${context.experienceDateRange ? `- ${labels.period}: ${context.experienceDateRange}` : ''}

${
  hasExistingDescription
    ? `**${labels.currentDesc}:**
${currentDescription}

`
    : ''
}**${labels.targetJob}:**
- ${labels.position}: ${context.jobTitle}
- ${labels.company}: ${context.companyName}
${
  context.jobDescription
    ? `- ${labels.jobDesc}:
${context.jobDescription.substring(0, 600)}...
`
    : ''
}
**${labels.skills}:** ${skillsList}

**${labels.userInstructions}:**
${instructions}

**${labels.rules}:**
1. ${labels.rule1}
2. **${labels.rule2}**
3. **${labels.rule3}**
4. **${labels.rule4}**
5. **${labels.rule5}**
6. ${labels.rule6}
7. **${labels.rule7}**
8. **${labels.rule8}**

**${labels.outputFormat}:**
<ul>
<li>${labels.example1}</li>
<li>Second bullet point...</li>
<li>Third bullet point...</li>
</ul>

**${labels.important}**

${labels.htmlList}:`;

    return this.callProvider(prompt, {
      temperature: 0.7,
      maxTokens: 800,
      systemMessage: labels.systemMsg,
    });
  }

  /**
   * Modify or generate project description using AI
   * Tailors bullet points to highlight technologies, outcomes, and impact
   * Returns HTML formatted bullets for Tiptap editor
   *
   * IMPORTANT: Responds in the same language as the existing content.
   * Only translates if explicitly requested in instructions.
   */
  async modifyProjectDescription(
    currentDescription: string | undefined,
    instructions: string,
    context: {
      projectName: string;
      projectDate?: string;
      jobTitle: string;
      companyName: string;
      jobDescription?: string;
      skills?: string[];
    },
  ): Promise<string> {
    this.logger.log(
      `Modifying project description for ${context.projectName} with instructions: ${instructions.substring(0, 50)}...`,
    );

    const skillsList = context.skills?.length ? context.skills.join(', ') : 'Not specified';
    const hasExistingDescription = currentDescription && currentDescription.trim().length > 0;

    // Detect language of existing content to maintain consistency
    const contentLanguage = hasExistingDescription
      ? this.detectContentLanguage(currentDescription)
      : 'en'; // Default to English for new content

    const isGerman = contentLanguage === 'de';

    this.logger.log(`Detected content language: ${contentLanguage}`);

    // Language-specific labels
    const labels = isGerman
      ? {
          role: 'Karriereberater',
          action: hasExistingDescription ? 'verbessern' : 'erstellen',
          project: 'PROJEKT DAS BEARBEITET WIRD',
          name: 'Name',
          period: 'Zeitraum',
          currentDesc: 'Aktuelle Beschreibung',
          targetJob: 'ZIELSTELLE (für Relevanz)',
          position: 'Position',
          company: 'Unternehmen',
          jobDesc: 'Stellenbeschreibung (Auszug)',
          skills: 'Relevante Skills des Kandidaten',
          userInstructions: 'Anweisungen des Kandidaten',
          rules: 'WICHTIGE REGELN',
          rule1: hasExistingDescription
            ? 'Wende die gewünschten Änderungen präzise an'
            : 'Erstelle 3-5 aussagekräftige Bullet-Points',
          rule2:
            'Jeder Bullet-Point MUSS mit einem starken Aktionsverb beginnen (Entwickelte, Implementierte, Konzipierte, Optimierte, etc.)',
          rule3: 'Betone verwendete Technologien und Tools wo relevant',
          rule4:
            'Quantifiziere Ergebnisse und Impact (%, Anzahl User, Performance-Verbesserung, etc.)',
          rule5: 'Fokussiere auf Problemlösung und Ergebnisse, nicht nur Features',
          rule6: 'Priorisiere Punkte nach Relevanz zur Zielstelle',
          rule7: 'Halte jeden Punkt auf 1-2 Zeilen (maximal 20 Wörter pro Punkt)',
          rule8: 'Gib die Antwort als HTML-Aufzählung zurück (KEIN Markdown!)',
          rule9:
            'ANTWORTE AUF DEUTSCH, es sei denn die Anweisungen verlangen explizit eine Übersetzung',
          outputFormat: 'OUTPUT FORMAT (HTML)',
          example1: 'Erster Bullet-Point mit Technologie und messbarem Ergebnis',
          important: 'Gib NUR das <ul>...</ul> HTML zurück, keine Erklärungen, kein Markdown!',
          htmlList: 'HTML-Aufzählung',
          systemMsg:
            'Du bist ein Experte für ATS-optimierte Lebensläufe. Du schreibst prägnante, wirkungsvolle Projekt-Beschreibungen mit Technologie-Fokus und quantifizierbaren Ergebnissen. Antworte auf Deutsch. Gib nur HTML-formatierte Listen zurück, kein Markdown.',
        }
      : {
          role: 'career coach',
          action: hasExistingDescription ? 'improve' : 'create',
          project: 'PROJECT BEING EDITED',
          name: 'Name',
          period: 'Period',
          currentDesc: 'Current Description',
          targetJob: 'TARGET POSITION (for relevance)',
          position: 'Position',
          company: 'Company',
          jobDesc: 'Job Description (excerpt)',
          skills: "Candidate's relevant skills",
          userInstructions: "User's Instructions",
          rules: 'IMPORTANT RULES',
          rule1: hasExistingDescription
            ? 'Apply the requested changes precisely'
            : 'Create 3-5 impactful bullet points',
          rule2:
            'Each bullet point MUST start with a strong action verb (Developed, Implemented, Designed, Optimized, etc.)',
          rule3: 'Emphasize technologies and tools used where relevant',
          rule4: 'Quantify results and impact (%, user count, performance improvements, etc.)',
          rule5: 'Focus on problem-solving and outcomes, not just features',
          rule6: 'Prioritize points by relevance to target position',
          rule7: 'Keep each point to 1-2 lines (max 20 words per point)',
          rule8: 'Return the answer as an HTML list (NO Markdown!)',
          rule9: 'RESPOND IN ENGLISH, unless the instructions explicitly request translation',
          outputFormat: 'OUTPUT FORMAT (HTML)',
          example1: 'First bullet point with technology and measurable outcome',
          important: 'Return ONLY the <ul>...</ul> HTML, no explanations, no Markdown!',
          htmlList: 'HTML List',
          systemMsg:
            'You are an expert in ATS-optimized resumes. You write concise, impactful project descriptions with technology focus and quantifiable outcomes. Respond in English. Return only HTML-formatted lists, no Markdown.',
        };

    const prompt = `You are a professional ${labels.role} helping a candidate ${labels.action} their project description for their resume.

**${labels.project}:**
- ${labels.name}: ${context.projectName}
${context.projectDate ? `- ${labels.period}: ${context.projectDate}` : ''}

${
  hasExistingDescription
    ? `**${labels.currentDesc}:**
${currentDescription}

`
    : ''
}**${labels.targetJob}:**
- ${labels.position}: ${context.jobTitle}
- ${labels.company}: ${context.companyName}
${
  context.jobDescription
    ? `- ${labels.jobDesc}:
${context.jobDescription.substring(0, 600)}...
`
    : ''
}
**${labels.skills}:** ${skillsList}

**${labels.userInstructions}:**
${instructions}

**${labels.rules}:**
1. ${labels.rule1}
2. **${labels.rule2}**
3. **${labels.rule3}**
4. **${labels.rule4}**
5. **${labels.rule5}**
6. **${labels.rule6}**
7. ${labels.rule7}
8. **${labels.rule8}**
9. **${labels.rule9}**

**${labels.outputFormat}:**
<ul>
<li>${labels.example1}</li>
<li>Second bullet point...</li>
<li>Third bullet point...</li>
</ul>

**${labels.important}**

${labels.htmlList}:`;

    return this.callProvider(prompt, {
      temperature: 0.7,
      maxTokens: 800,
      systemMessage: labels.systemMsg,
    });
  }

  private async loadTemplate(fileName: string): Promise<string> {
    const templatePath = path.join(process.cwd(), 'prompts', fileName);
    try {
      return await fs.readFile(templatePath, 'utf-8');
    } catch (error) {
      this.logger.error(`Failed to load template: ${fileName}`, error);
      throw new Error(`Template not found: ${fileName}`);
    }
  }

  private renderTemplate(template: string, context: any): string {
    let rendered = template;

    // Handle {{json variable}} syntax for JSON serialization
    for (const [key, value] of Object.entries(context)) {
      const jsonPlaceholder = new RegExp(`{{json ${key}}}`, 'g');
      if (rendered.match(jsonPlaceholder)) {
        rendered = rendered.replace(jsonPlaceholder, JSON.stringify(value, null, 2));
      }
    }

    // Simple template variable replacement
    for (const [key, value] of Object.entries(context)) {
      const placeholder = new RegExp(`{{${key}}}`, 'g');
      rendered = rendered.replace(placeholder, String(value));
    }

    return rendered;
  }

  /**
   * Strip LLM placeholder patterns from generated text
   * Removes patterns like "[Your Name]", "[Dein Name]", and closing signatures
   */
  private stripLLMPlaceholders(content: string): string {
    if (!content) return '';

    let result = content;

    // Pattern 1: Remove square bracket placeholders (multilingual)
    // e.g., "[Your Name]", "[Ihr Name]", "[Full Name]", "[Name]", "[Signature]"
    const bracketPattern =
      /\[(?:Your|Ihr|Dein|Their|My|Mein|Our|Unser|The|Der|Die|Das|Full|Vollständiger?|Candidate'?s?)?\s*(?:Name|Address|Adresse|Signature|Unterschrift|Title|Titel|Phone|Telefon|Email|E-Mail|Date|Datum|Company|Firma|Position|Stelle)[\w\s]*\]/gi;
    result = result.replace(bracketPattern, '');

    // Pattern 2: Remove name line after closing phrase in HTML
    // Matches: <p>Mit freundlichen Grüßen</p>\n<p>Max Mustermann</p>
    const htmlClosingWithNamePattern =
      /(<p>(?:Sincerely|Best regards|Mit freundlichen Grüßen|Beste Grüße|Cordiali saluti|Cordialement|Atentamente),?<\/p>)\s*<p>[A-ZÄÖÜ][a-zA-ZäöüÄÖÜßéèêëàâçîïôûùÿœ]+(?:\s+[A-ZÄÖÜ][a-zA-ZäöüÄÖÜßéèêëàâçîïôûùÿœ]+)*<\/p>\s*$/gi;
    result = result.replace(htmlClosingWithNamePattern, '$1');

    // Pattern 3: Remove name line after closing phrase in plain text/markdown
    // Matches: "Sincerely,\n\nJohn Doe" or "Mit freundlichen Grüßen\n\nMax Mustermann"
    const textClosingWithNamePattern =
      /(Sincerely|Best regards|Mit freundlichen Grüßen|Beste Grüße|Cordiali saluti|Cordialement|Atentamente),?\s*\n+\s*[A-ZÄÖÜ][a-zA-ZäöüÄÖÜßéèêëàâçîïôûùÿœ]+(?:\s+[A-ZÄÖÜ][a-zA-ZäöüÄÖÜßéèêëàâçîïôûùÿœ]+)*\s*$/gm;
    result = result.replace(textClosingWithNamePattern, '$1,');

    // Pattern 4: Strip standalone closing phrase at the end (safety fallback)
    // The template adds closing phrase automatically, so remove any LLM-generated ones
    result = stripClosingPhrase(result);

    // Clean up excess newlines and whitespace
    result = result.replace(/\n{3,}/g, '\n\n').trim();

    return result;
  }

  /**
   * Build context for ATS cover letter template with formatted keywords
   */
  private buildATSCoverLetterContext(context: ATSCoverLetterContext): Record<string, string> {
    const matchedKeywordsList = context.matchedKeywords
      .map((k) => `- ${k.keyword} (${k.category})`)
      .join('\n');

    const missingKeywordsList = context.missingKeywords
      .map((k) => `- ${k.keyword} (${k.category})`)
      .join('\n');

    // Extract keywords by category
    const technicalKeywords = context.matchedKeywords
      .filter((k) => k.category === 'core' || k.category === 'methodology')
      .map((k) => k.keyword)
      .join(', ');

    const softSkillKeywords = context.matchedKeywords
      .filter((k) => k.category === 'soft')
      .map((k) => k.keyword)
      .join(', ');

    const experienceKeywords = context.matchedKeywords
      .filter((k) => k.category === 'seniority' || k.category === 'requirement')
      .map((k) => k.keyword)
      .join(', ');

    const industryKeywords = context.matchedKeywords
      .filter((k) => k.category === 'industry')
      .map((k) => k.keyword)
      .join(', ');

    const language = context.language || 'en';

    return {
      profile: context.profile,
      jobTitle: context.jobTitle,
      companyName: context.companyName,
      location: context.location || 'Not specified',
      jobDescription: context.jobDescription || '',
      matchedKeywords: matchedKeywordsList || 'None identified',
      missingKeywords: missingKeywordsList || 'None',
      technicalKeywords: technicalKeywords || 'None',
      softSkillKeywords: softSkillKeywords || 'None',
      experienceKeywords: experienceKeywords || 'None',
      industryKeywords: industryKeywords || 'None',
      language: language,
      languageName: language === 'de' ? 'German' : 'English',
    };
  }

  /**
   * Build context for ATS resume template with formatted keywords
   */
  private buildATSResumeContext(context: ATSResumeContext): Record<string, string> {
    const matchedKeywordsList = context.matchedKeywords
      .map((k) => `- ${k.keyword} (${k.category})`)
      .join('\n');

    const missingKeywordsList = context.missingKeywords
      .map((k) => `- ${k.keyword} (${k.category})`)
      .join('\n');

    // Priority keywords are matched core skills and methodologies (most important for ATS)
    const priorityKeywords = context.matchedKeywords
      .filter((k) => k.category === 'core' || k.category === 'methodology')
      .slice(0, 7)
      .map((k) => k.keyword)
      .join(', ');

    const language = context.language || 'en';

    return {
      profile: context.profile,
      jobTitle: context.jobTitle,
      companyName: context.companyName,
      jobDescription: context.jobDescription || '',
      matchedKeywords: matchedKeywordsList || 'None identified',
      missingKeywords: missingKeywordsList || 'None',
      priorityKeywords: priorityKeywords || 'None',
      language: language,
      languageName: language === 'de' ? 'German' : 'English',
    };
  }
}

/**
 * Context for standard cover letter generation
 */
export interface CoverLetterContext {
  candidateName: string;
  jobTitle: string;
  companyName: string;
  skills: string;
  experiences: string;
  motivation: string;
}

/**
 * Context for standard resume generation
 */
export interface ResumeContext {
  candidateName: string;
  contactInfo: string;
  summary: string;
  skills: string;
  experiences: string;
  education: string;
  certificates: string;
  projects: string;
}

/**
 * Keyword match structure for ATS optimization
 */
export interface KeywordMatch {
  keyword: string;
  category: 'core' | 'soft' | 'methodology' | 'industry' | 'seniority' | 'requirement' | 'misc';
  found: boolean;
  confidence: number;
}

/**
 * Context for ATS-optimized cover letter generation
 * Includes extracted keywords for strategic placement
 */
export interface ATSCoverLetterContext {
  /** Formatted profile string with candidate details */
  profile: string;
  /** Job title from posting (use exact wording) */
  jobTitle: string;
  /** Company name */
  companyName: string;
  /** Job location */
  location?: string;
  /** Full job description text */
  jobDescription?: string;
  /** Keywords that match between job posting and candidate profile */
  matchedKeywords: KeywordMatch[];
  /** Keywords from job posting not found in candidate profile */
  missingKeywords: KeywordMatch[];
  /** Detected language code ('de' for German, 'en' for English) */
  language?: string;
}

/**
 * Context for ATS-optimized resume generation
 * Includes extracted keywords for strategic placement
 */
export interface ATSResumeContext {
  /** Formatted profile string with candidate details */
  profile: string;
  /** Job title from posting (use exact wording) */
  jobTitle: string;
  /** Company name */
  companyName: string;
  /** Full job description text */
  jobDescription?: string;
  /** Keywords that match between job posting and candidate profile */
  matchedKeywords: KeywordMatch[];
  /** Keywords from job posting not found in candidate profile */
  missingKeywords: KeywordMatch[];
  /** Detected language code ('de' for German, 'en' for English) */
  language?: string;
}

/**
 * Context for intelligent skill categorization
 */
export interface SkillCategorizationContext {
  /** List of skill names to categorize */
  skills: string[];
  /** Candidate context (e.g., "Senior Software Engineer", "Marketing Manager") */
  candidateContext?: string;
  /** Industry or field (e.g., "IT", "Healthcare", "Finance") */
  industry?: string;
}

/**
 * Skill category result
 */
export interface SkillCategory {
  /** Category name (e.g., "Programming Languages", "Digital Marketing") */
  type: string;
  /** List of skills in this category */
  skills: string[];
}
