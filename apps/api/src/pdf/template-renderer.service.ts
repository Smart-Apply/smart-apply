import { Injectable, Logger } from '@nestjs/common';
import * as Handlebars from 'handlebars';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { TemplatesService } from '../templates/templates.service';
import { TemplateType } from '@prisma/client';

export interface CoverLetterTemplateData {
  candidateName: string;
  email?: string;
  phone?: string;
  linkedin?: string;
  github?: string;
  location?: string;
  date?: string;
  recipientName?: string;
  companyName?: string;
  companyAddress?: string;
  content: string; // HTML content from LLM
  closingPhrase?: string;
  footer?: string;
}

export interface ResumeTemplateData {
  candidateName: string;
  email?: string;
  phone?: string;
  linkedin?: string;
  github?: string;
  location?: string;
  summary?: string;
  skillCategories?: SkillCategory[];
  experiences?: Experience[];
  projects?: Project[];
  education?: Education[];
  certifications?: Certification[];
}

export interface SkillCategory {
  type: string; // Languages, Frameworks, Cloud, Databases, Tools, Other
  skills: string[];
}

export interface Experience {
  title: string;
  company: string;
  location?: string;
  dateRange: string; // e.g., "Jan 2020 - Present"
  achievements?: string[]; // HTML strings
}

export interface Project {
  name: string;
  description?: string;
  date?: string;
  highlights?: string[]; // HTML strings
}

export interface Education {
  degree: string;
  institution: string;
  year: string;
  fieldOfStudy?: string;
  gpa?: string;
  description?: string;
}

export interface Certification {
  name: string;
  issuer: string;
  date?: string;
}

@Injectable()
export class TemplateRendererService {
  private readonly logger = new Logger(TemplateRendererService.name);
  private templatesDir: string;
  private stylesDir: string;

  constructor(private readonly templatesService: TemplatesService) {
    // Determine if running from source or dist
    // __dirname when running from dist: /Users/.../dist/apps/api/pdf
    // __dirname when running from src (ts-node): /Users/.../apps/api/src/pdf
    
    const isDevelopment = __dirname.includes('/src/');
    
    if (isDevelopment) {
      // Development mode (ts-node): Use source templates
      this.templatesDir = path.join(__dirname, 'templates');
      this.stylesDir = path.join(__dirname, 'styles');
      this.logger.log('Running in DEVELOPMENT mode (from source)');
    } else {
      // Production/compiled mode: Navigate from dist to source
      // __dirname is like: /Users/.../dist/apps/api/pdf
      // We need to go: ../../../../apps/api/src/pdf/templates
      const projectRoot = path.join(__dirname, '../../../..');
      this.templatesDir = path.join(projectRoot, 'apps/api/src/pdf/templates');
      this.stylesDir = path.join(projectRoot, 'apps/api/src/pdf/styles');
      this.logger.log('Running in COMPILED mode (using source templates)');
    }

    this.logger.log(`Templates directory: ${this.templatesDir}`);
    this.logger.log(`Styles directory: ${this.stylesDir}`);

    this.registerHelpers();
  }

  /**
   * Register Handlebars helpers
   */
  private registerHelpers(): void {
    // Helper to convert string to lowercase
    Handlebars.registerHelper('toLowerCase', (str: string) => {
      return str ? str.toLowerCase().replace(/\s+/g, '-') : '';
    });

    // Helper for conditional rendering
    Handlebars.registerHelper('ifCond', function (v1, operator, v2, options) {
      switch (operator) {
        case '==':
          return v1 == v2 ? options.fn(this) : options.inverse(this);
        case '===':
          return v1 === v2 ? options.fn(this) : options.inverse(this);
        case '!=':
          return v1 != v2 ? options.fn(this) : options.inverse(this);
        case '!==':
          return v1 !== v2 ? options.fn(this) : options.inverse(this);
        case '<':
          return v1 < v2 ? options.fn(this) : options.inverse(this);
        case '<=':
          return v1 <= v2 ? options.fn(this) : options.inverse(this);
        case '>':
          return v1 > v2 ? options.fn(this) : options.inverse(this);
        case '>=':
          return v1 >= v2 ? options.fn(this) : options.inverse(this);
        default:
          return options.inverse(this);
      }
    });
  }

  /**
   * Render cover letter template with optional templateId and ATS optimization
   */
  async renderCoverLetter(
    data: CoverLetterTemplateData,
    templateId?: string,
    atsOptimized = false,
  ): Promise<string> {
    try {
      let template: string;
      let css: string;

      if (atsOptimized) {
        // Use ATS-optimized template from filesystem
        this.logger.log('Loading ATS-optimized cover letter template');
        template = await this.loadTemplate('cover-letter-ats.hbs');
        css = await this.loadStyles(['base-ats.css', 'cover-letter-ats.css']);
      } else if (templateId) {
        // Load specific template from database
        this.logger.log(`Loading cover letter template: ${templateId}`);
        const dbTemplate = await this.templatesService.findOne(templateId);
        template = dbTemplate.htmlTemplate;
        css = dbTemplate.cssStyles;
      } else {
        // Load default template from database
        this.logger.log('Loading default cover letter template');
        const defaultTemplate = await this.templatesService.findDefault(
          TemplateType.COVER_LETTER,
        );
        template = defaultTemplate.htmlTemplate;
        css = defaultTemplate.cssStyles;
      }

      // Set default values
      const templateData = {
        ...data,
        date:
          data.date ||
          new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }),
        closingPhrase: data.closingPhrase || 'Sincerely,',
      };

      const compiledTemplate = Handlebars.compile(template);
      const html = compiledTemplate(templateData);

      return this.wrapWithStyles(html, css);
    } catch (error) {
      this.logger.error('Failed to render cover letter template', error);
      throw new Error(`Cover letter template rendering failed: ${error.message}`);
    }
  }

  /**
   * Render resume template with optional templateId and ATS optimization
   */
  async renderResume(
    data: ResumeTemplateData, 
    templateId?: string, 
    atsOptimized = false,
  ): Promise<string> {
    try {
      let template: string;
      let css: string;

      if (atsOptimized) {
        // Use ATS-optimized template from filesystem
        this.logger.log('Loading ATS-optimized resume template');
        template = await this.loadTemplate('resume-ats.hbs');
        css = await this.loadStyles(['base-ats.css', 'resume-ats.css']);
      } else if (templateId) {
        // Load specific template from database
        this.logger.log(`Loading resume template: ${templateId}`);
        const dbTemplate = await this.templatesService.findOne(templateId);
        template = dbTemplate.htmlTemplate;
        css = dbTemplate.cssStyles;
      } else {
        // Load default template from database
        this.logger.log('Loading default resume template');
        const defaultTemplate = await this.templatesService.findDefault(TemplateType.RESUME);
        template = defaultTemplate.htmlTemplate;
        css = defaultTemplate.cssStyles;
      }

      const compiledTemplate = Handlebars.compile(template);
      const html = compiledTemplate(data);

      return this.wrapWithStyles(html, css);
    } catch (error) {
      this.logger.error('Failed to render resume template', error);
      throw new Error(`Resume template rendering failed: ${error.message}`);
    }
  }

  /**
   * Load a template file
   */
  private async loadTemplate(fileName: string): Promise<string> {
    const templatePath = path.join(this.templatesDir, fileName);
    try {
      return await fs.readFile(templatePath, 'utf-8');
    } catch (error) {
      this.logger.error(`Failed to load template: ${fileName}`, error);
      throw new Error(`Template not found: ${fileName}`);
    }
  }

  /**
   * Load and combine multiple CSS files
   */
  private async loadStyles(fileNames: string[]): Promise<string> {
    const cssPromises = fileNames.map(async (fileName) => {
      const cssPath = path.join(this.stylesDir, fileName);
      try {
        return await fs.readFile(cssPath, 'utf-8');
      } catch (error) {
        this.logger.warn(`Failed to load CSS file: ${fileName}`, error);
        return '';
      }
    });

    const cssFiles = await Promise.all(cssPromises);
    return cssFiles.filter((css) => css.length > 0).join('\n\n');
  }

  /**
   * Wrap HTML with styles in a style tag
   */
  private wrapWithStyles(html: string, css: string): string {
    // Insert styles into the head section if it exists, or add a head section
    if (html.includes('</head>')) {
      return html.replace('</head>', `<style>\n${css}\n</style>\n</head>`);
    } else if (html.includes('<html>')) {
      return html.replace('<html>', `<html>\n<head>\n<style>\n${css}\n</style>\n</head>`);
    } else {
      // Fallback: wrap everything
      return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
${css}
</style>
</head>
${html}
</html>`;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.loadTemplate('cover-letter.hbs');
      await this.loadTemplate('resume.hbs');
      return true;
    } catch {
      return false;
    }
  }
}
