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

  constructor(private readonly templatesService?: TemplatesService) {
    // Use process.cwd() which always points to the project root where npm start was run
    const projectRoot = process.cwd();

    // Check if source templates exist (development mode)
    const sourceTemplatesDir = path.join(projectRoot, 'apps', 'api', 'src', 'pdf', 'templates');

    // For production, templates are in dist/templates
    const distTemplatesDir = path.join(projectRoot, 'dist', 'templates');
    try {
      fsSync.accessSync(path.join(sourceTemplatesDir, 'cover-letter.hbs'));
      this.templatesDir = sourceTemplatesDir;
      this.stylesDir = path.join(projectRoot, 'apps', 'api', 'src', 'pdf', 'styles');
      this.logger.log('Running in DEVELOPMENT mode');
    } catch {
      this.templatesDir = distTemplatesDir;
      this.stylesDir = path.join(projectRoot, 'dist', 'styles');
      this.logger.log('Running in PRODUCTION mode');
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
   * Render cover letter template with optional templateId
   */
  async renderCoverLetter(
    data: CoverLetterTemplateData,
    templateId?: string,
  ): Promise<string> {
    try {
      let template: string;
      let css: string;

      if (templateId && this.templatesService) {
        // Load template from database
        const dbTemplate = await this.templatesService.findOne(templateId);
        template = dbTemplate.htmlTemplate;
        css = dbTemplate.cssStyles;
      } else if (this.templatesService) {
        // Load default template from database
        const defaultTemplate = await this.templatesService.findDefault(
          TemplateType.COVER_LETTER,
        );
        template = defaultTemplate.htmlTemplate;
        css = defaultTemplate.cssStyles;
      } else {
        // Fallback to file system templates (for backward compatibility)
        template = await this.loadTemplate('cover-letter.hbs');
        css = await this.loadStyles(['base.css', 'cover-letter.css']);
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
   * Render resume template with optional templateId
   */
  async renderResume(data: ResumeTemplateData, templateId?: string): Promise<string> {
    try {
      let template: string;
      let css: string;

      if (templateId && this.templatesService) {
        // Load template from database
        const dbTemplate = await this.templatesService.findOne(templateId);
        template = dbTemplate.htmlTemplate;
        css = dbTemplate.cssStyles;
      } else if (this.templatesService) {
        // Load default template from database
        const defaultTemplate = await this.templatesService.findDefault(TemplateType.RESUME);
        template = defaultTemplate.htmlTemplate;
        css = defaultTemplate.cssStyles;
      } else {
        // Fallback to file system templates (for backward compatibility)
        template = await this.loadTemplate('resume.hbs');
        css = await this.loadStyles(['base.css', 'resume.css']);
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
