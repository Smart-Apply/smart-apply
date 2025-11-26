import { Injectable, Inject, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { LLMProvider } from './llm.interface';

@Injectable()
export class LLMService {
  private readonly logger = new Logger(LLMService.name);

  constructor(
    @Inject('LLM_PROVIDER')
    private readonly provider: LLMProvider,
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
      .filter((k) => k.category === 'technical' || k.category === 'tool')
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

    // Priority keywords are matched technical skills and tools (most important for ATS)
    const priorityKeywords = context.matchedKeywords
      .filter((k) => k.category === 'technical' || k.category === 'tool')
      .slice(0, 7)
      .map((k) => k.keyword)
      .join(', ');

    return {
      profile: context.profile,
      jobTitle: context.jobTitle,
      companyName: context.companyName,
      jobDescription: context.jobDescription || '',
      matchedKeywords: matchedKeywordsList || 'None identified',
      missingKeywords: missingKeywordsList || 'None',
      priorityKeywords: priorityKeywords || 'None',
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
  category: 'technical' | 'soft' | 'tool' | 'industry' | 'seniority' | 'requirement' | 'misc';
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
}
