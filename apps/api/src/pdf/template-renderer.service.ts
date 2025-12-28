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
  language?: string; // Language code ('de', 'en', etc.) for localized content
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
  languages?: ResumeLanguage[];
  language?: string; // Language code ('de', 'en', etc.) for localized section headers
}

export interface ResumeLanguage {
  name: string;
  level?: string;
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
  description?: string; // Job description / responsibilities
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
  private stylesDir: string; // Legacy - kept for backward compatibility
  
  // Cache for loaded CSS (template id -> combined CSS)
  private cssCache: Map<string, string> = new Map();

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
    this.logger.log(`Styles directory (legacy): ${this.stylesDir}`);

    this.registerHelpers();
  }
  
  /**
   * Load CSS from the new folder structure (base.css + template/styles.css)
   * Falls back to legacy styles directory if new structure not found
   */
  private async loadTemplateCSS(templateId: string): Promise<string> {
    // Check cache first
    if (this.cssCache.has(templateId)) {
      return this.cssCache.get(templateId)!;
    }
    
    // Extract template folder name from ID (e.g., "modern-professional-resume" -> "modern-professional")
    const templateFolder = templateId.replace(/-resume$/, '').replace(/-cover-letter$/, '');
    const templateDir = path.join(this.templatesDir, templateFolder);
    const baseCssPath = path.join(this.templatesDir, '_base', 'base.css');
    const templateCssPath = path.join(templateDir, 'styles.css');
    
    let combinedCSS = '';
    
    // Try new folder structure first
    if (fsSync.existsSync(templateCssPath)) {
      // Load base CSS if available
      if (fsSync.existsSync(baseCssPath)) {
        const baseCSS = await fs.readFile(baseCssPath, 'utf-8');
        combinedCSS = baseCSS + '\n\n';
      }
      
      // Load template-specific CSS
      const templateCSS = await fs.readFile(templateCssPath, 'utf-8');
      combinedCSS += `/* Template: ${templateFolder} */\n${templateCSS}`;
      
      this.logger.debug(`Loaded CSS from new structure: ${templateFolder}`);
    } else {
      // Fallback to legacy styles directory
      const legacyCssPath = path.join(this.stylesDir, `${templateFolder}.css`);
      if (fsSync.existsSync(legacyCssPath)) {
        combinedCSS = await fs.readFile(legacyCssPath, 'utf-8');
        this.logger.debug(`Loaded CSS from legacy path: ${legacyCssPath}`);
      }
    }
    
    // Cache the result
    if (combinedCSS) {
      this.cssCache.set(templateId, combinedCSS);
    }
    
    return combinedCSS;
  }
  
  /**
   * Clear CSS cache (useful for development/hot reload)
   */
  clearCSSCache(): void {
    this.cssCache.clear();
    this.logger.log('CSS cache cleared');
  }
  
  /**
   * Load a template file from the new folder structure
   * Checks template folder first, then falls back to _base folder
   */
  private async loadTemplateFromFolder(templateFolder: string, fileName: string): Promise<string> {
    // Try template-specific file first (e.g., templates/creative-two-column/resume.hbs)
    const templateSpecificPath = path.join(this.templatesDir, templateFolder, fileName);
    if (fsSync.existsSync(templateSpecificPath)) {
      this.logger.debug(`Loading template from folder: ${templateFolder}/${fileName}`);
      return await fs.readFile(templateSpecificPath, 'utf-8');
    }
    
    // Fall back to _base folder (e.g., templates/_base/resume.hbs)
    const basePath = path.join(this.templatesDir, '_base', fileName);
    if (fsSync.existsSync(basePath)) {
      this.logger.debug(`Loading template from _base: ${fileName}`);
      return await fs.readFile(basePath, 'utf-8');
    }
    
    // Final fallback to legacy flat structure (e.g., templates/resume.hbs)
    const legacyPath = path.join(this.templatesDir, fileName);
    if (fsSync.existsSync(legacyPath)) {
      this.logger.debug(`Loading template from legacy path: ${fileName}`);
      return await fs.readFile(legacyPath, 'utf-8');
    }
    
    throw new Error(`Template not found: ${fileName} (checked ${templateFolder}, _base, and legacy paths)`);
  }

  /**
   * Register Handlebars helpers
   */
  private registerHelpers(): void {
    // Helper to convert string to lowercase
    Handlebars.registerHelper('toLowerCase', (str: string) => {
      return str ? str.toLowerCase().replace(/\s+/g, '-') : '';
    });

    // Helper to convert newlines to <br> tags for HTML rendering
    Handlebars.registerHelper('nl2br', (text: string) => {
      if (!text) return '';
      // Convert newlines to <br> tags and return as SafeString (allows HTML)
      const html = text.replace(/\n/g, '<br>');
      return new Handlebars.SafeString(html);
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

    // Format date helper - formats ISO date strings to readable format
    Handlebars.registerHelper('formatDate', function (dateString: string, language?: string) {
      if (!dateString) return '';
      
      try {
        const date = new Date(dateString);
        const lang = (typeof language === 'string' ? language : 'en') || 'en';
        
        const monthNames = {
          en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
          de: ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'],
          fr: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'],
          es: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
          it: ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'],
        };
        
        const months = monthNames[lang] || monthNames.en;
        const year = date.getFullYear();
        const month = months[date.getMonth()];
        
        return `${month} ${year}`;
      } catch (error) {
        return dateString;
      }
    });

    // Translation helper for multilingual templates
    // Usage: {{t "resume.summary" @root.language}}
    Handlebars.registerHelper('t', function (key: string, language?: string) {
      // If language is not provided or is an object (Handlebars context), try to extract from @root
      if (!language || typeof language === 'object') {
        // Try to get from root context if available
        const context = (this as any);
        language = context?.language || 'en';
      }
      
      const lang = language || 'en';
      const translations: Record<string, Record<string, string>> = {
        'contact': {
          en: 'Contact',
          de: 'Kontakt',
          fr: 'Contact',
          es: 'Contacto',
          it: 'Contatto',
        },
        'resume.summary': {
          en: 'Professional Summary',
          de: 'Profil',
          fr: 'Résumé Professionnel',
          es: 'Resumen Profesional',
          it: 'Profilo Professionale',
        },
        'resume.skills': {
          en: 'Skills',
          de: 'Fähigkeiten',
          fr: 'Compétences',
          es: 'Habilidades',
          it: 'Competenze',
        },
        'resume.experience': {
          en: 'Professional Experience',
          de: 'Berufserfahrung',
          fr: 'Expérience Professionnelle',
          es: 'Experiencia Profesional',
          it: 'Esperienza Professionale',
        },
        'resume.education': {
          en: 'Education',
          de: 'Ausbildung',
          fr: 'Formation',
          es: 'Educación',
          it: 'Formazione',
        },
        'resume.certifications': {
          en: 'Certifications',
          de: 'Zertifikate',
          fr: 'Certifications',
          es: 'Certificaciones',
          it: 'Certificazioni',
        },
        'resume.languages': {
          en: 'Languages',
          de: 'Sprachen',
          fr: 'Langues',
          es: 'Idiomas',
          it: 'Lingue',
        },
        'resume.projects': {
          en: 'Key Projects',
          de: 'Wichtige Projekte',
          fr: 'Projets Clés',
          es: 'Proyectos Clave',
          it: 'Progetti Chiave',
        },
      };

      return translations[key]?.[lang] || translations[key]?.['en'] || key;
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
      let language = 'en'; // Default language

      if (atsOptimized) {
        // Use ATS-optimized template from filesystem (new folder structure)
        this.logger.log('Loading ATS-optimized cover letter template');
        template = await this.loadTemplateFromFolder('_base', 'cover-letter.hbs');
        css = await this.loadTemplateCSS('modern-professional'); // Default ATS template
      } else if (templateId) {
        // Load specific template from database
        this.logger.log(`Loading cover letter template: ${templateId}`);
        const dbTemplate = await this.templatesService.findOne(templateId);
        template = dbTemplate.htmlTemplate;
        css = dbTemplate.cssStyles;
        language = dbTemplate.language || 'en'; // Use template's language
      } else {
        // Load default template from database
        this.logger.log('Loading default cover letter template');
        const defaultTemplate = await this.templatesService.findDefault(TemplateType.COVER_LETTER);
        template = defaultTemplate.htmlTemplate;
        css = defaultTemplate.cssStyles;
        language = defaultTemplate.language || 'en'; // Use template's language
      }

      // Set default values
      const templateData = {
        ...data,
        language, // Add language to template data for 't' helper
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
      let language = 'en'; // Default language

      if (atsOptimized) {
        // Use ATS-optimized template from filesystem (new folder structure)
        this.logger.log('Loading ATS-optimized resume template');
        template = await this.loadTemplateFromFolder('_base', 'resume.hbs');
        css = await this.loadTemplateCSS('modern-professional'); // Default ATS template
      } else if (templateId) {
        // Load specific template from database
        this.logger.log(`Loading resume template: ${templateId}`);
        const dbTemplate = await this.templatesService.findOne(templateId);
        template = dbTemplate.htmlTemplate;
        css = dbTemplate.cssStyles;
        language = dbTemplate.language || 'en'; // Use template's language
      } else {
        // Load default template from database
        this.logger.log('Loading default resume template');
        const defaultTemplate = await this.templatesService.findDefault(TemplateType.RESUME);
        template = defaultTemplate.htmlTemplate;
        css = defaultTemplate.cssStyles;
        language = defaultTemplate.language || 'en'; // Use template's language
      }

      // Add language to template data for 't' helper
      const templateData = { ...data, language };
      const compiledTemplate = Handlebars.compile(template);
      const html = compiledTemplate(templateData);

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
