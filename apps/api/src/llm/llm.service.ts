import { Injectable, Inject, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { LLMProvider } from './llm.interface';
import { ConfigService } from '../config/config.service';

@Injectable()
export class LLMService {
  private readonly logger = new Logger(LLMService.name);

  constructor(
    @Inject('LLM_PROVIDER')
    private readonly provider: LLMProvider,
    private readonly configService: ConfigService,
  ) {}

  async generateCoverLetter(context: CoverLetterContext): Promise<string> {
    const template = await this.loadTemplate('cover-letter.md');
    const prompt = this.renderTemplate(template, context);

    return this.provider.generateText(prompt, {
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

    return this.provider.generateText(prompt, {
      temperature: 0.7,
      maxTokens: 1500,
      systemMessage:
        'You are an expert ATS-optimization specialist and career coach. You write compelling cover letters that pass Applicant Tracking Systems while remaining engaging for human readers. You strategically place keywords for maximum ATS match rate without sacrificing readability.',
    });
  }

  async generateResume(context: ResumeContext): Promise<string> {
    const template = await this.loadTemplate('resume.md');
    const prompt = this.renderTemplate(template, context);

    return this.provider.generateText(prompt, {
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

    return this.provider.generateText(prompt, {
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
    return this.provider.generateText(prompt, options);
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
      const response = await this.provider.generateText(prompt, defaultOptions);
      const duration = Date.now() - startTime;

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
      const response = await this.provider.generateText(prompt, defaultOptions);
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
      const response = await this.provider.generateText(prompt, {
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
   * Translate professional summary to target language
   * Preserves professional tone and key information
   */
  async translateSummary(
    summary: string,
    fromLanguage: string,
    toLanguage: string,
  ): Promise<string> {
    if (!summary || fromLanguage === toLanguage) {
      return summary;
    }

    const languageNames: Record<string, string> = {
      de: 'German',
      en: 'English',
      fr: 'French',
      es: 'Spanish',
    };

    const fromLang = languageNames[fromLanguage] || fromLanguage;
    const toLang = languageNames[toLanguage] || toLanguage;

    this.logger.log(`Translating summary from ${fromLang} to ${toLang}`);

    const prompt = `Translate the following professional summary from ${fromLang} to ${toLang}.

**Original Summary (${fromLang}):**
${summary}

**Instructions:**
1. Translate accurately while maintaining professional tone
2. Keep the same length (2-3 sentences)
3. Preserve key achievements, years of experience, and technical terms
4. Technical terms (React, Docker, AWS, etc.) should remain in English
5. Return ONLY the translated text, no explanations

**Translated Summary (${toLang}):**`;

    return this.provider.generateText(prompt, {
      temperature: 0.3, // Lower temperature for accurate translation
      maxTokens: 500,
      systemMessage: `You are a professional translator specializing in resume and career documents. You translate accurately while maintaining professional tone and preserving technical terminology.`,
    });
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

    return this.provider.generateText(prompt, {
      temperature: 0.7,
      maxTokens: 2000,
      systemMessage:
        'Du bist ein Experte im Verfassen und Optimieren von Bewerbungsanschreiben. Du wendest Änderungswünsche präzise an und behältst dabei professionelle Qualität.',
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
