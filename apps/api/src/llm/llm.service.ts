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
}

export interface CoverLetterContext {
  candidateName: string;
  jobTitle: string;
  companyName: string;
  skills: string;
  experiences: string;
  motivation: string;
}

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
