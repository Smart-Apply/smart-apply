import { Injectable, Logger } from '@nestjs/common';
import * as Handlebars from 'handlebars';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { TemplatesService } from '../templates/templates.service';
import { TemplateType } from '@prisma/client';

export interface CoverLetterTemplateData {
  candidateName: string;
  targetJobTitle?: string; // Target job title for CV/CL (displayed under name)
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
  targetJobTitle?: string; // Target job title for CV/CL (displayed under name)
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

    throw new Error(
      `Template not found: ${fileName} (checked ${templateFolder}, _base, and legacy paths)`,
    );
  }

  /**
   * Register Handlebars helpers
   */
  private registerHelpers(): void {
    // Helper to convert string to lowercase
    Handlebars.registerHelper('toLowerCase', (str: string) => {
      return str ? str.toLowerCase().replace(/\s+/g, '-') : '';
    });

    // Helper to convert newlines to <br> tags while preserving existing HTML
    Handlebars.registerHelper('nl2br', (text: unknown) => {
      if (!text) return '';
      // Handle SafeString - get the raw HTML string without escaping
      let str: string;
      if (text instanceof Handlebars.SafeString) {
        str = text.toString();
      } else if (typeof text === 'string') {
        str = text;
      } else {
        str = (text as { toString(): string }).toString();
      }
      // Convert newlines to <br> tags and return as SafeString (allows HTML)
      const html = str.replace(/\n/g, '<br>');
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
    // Usage: {{t "resume.summary" language}} or {{t this.level @root.language}}
    Handlebars.registerHelper('t', function (...args: unknown[]) {
      // Handlebars always passes options as the last argument
      const options = args[args.length - 1] as Handlebars.HelperOptions;
      const key = args[0] as string;
      const passedLanguage = args.length > 2 ? args[1] : undefined;

      // Determine the language: use passed value, or get from root context via options.data.root
      let lang: string;
      if (typeof passedLanguage === 'string' && passedLanguage) {
        lang = passedLanguage;
      } else if (options?.data?.root?.language) {
        lang = options.data.root.language as string;
      } else {
        lang = 'en';
      }

      const translations: Record<string, Record<string, string>> = {
        contact: {
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
        // Language proficiency levels
        'level.native': {
          en: 'Native',
          de: 'Muttersprache',
          fr: 'Langue maternelle',
          es: 'Nativo',
          it: 'Madrelingua',
        },
        'level.fluent': {
          en: 'Fluent',
          de: 'Fließend',
          fr: 'Courant',
          es: 'Fluido',
          it: 'Fluente',
        },
        'level.good': {
          en: 'Good',
          de: 'Gut',
          fr: 'Bon',
          es: 'Bueno',
          it: 'Buono',
        },
        'level.basic': {
          en: 'Basic',
          de: 'Grundkenntnisse',
          fr: 'Notions de base',
          es: 'Básico',
          it: 'Base',
        },
        'level.conversational': {
          en: 'Conversational',
          de: 'Konversationssicher',
          fr: 'Conversationnel',
          es: 'Conversacional',
          it: 'Conversazionale',
        },
        'level.advanced': {
          en: 'Advanced',
          de: 'Fortgeschritten',
          fr: 'Avancé',
          es: 'Avanzado',
          it: 'Avanzato',
        },
        'level.intermediate': {
          en: 'Intermediate',
          de: 'Mittelstufe',
          fr: 'Intermédiaire',
          es: 'Intermedio',
          it: 'Intermedio',
        },
        'level.beginner': {
          en: 'Beginner',
          de: 'Anfänger',
          fr: 'Débutant',
          es: 'Principiante',
          it: 'Principiante',
        },
        // Language names
        'lang.english': {
          en: 'English',
          de: 'Englisch',
          fr: 'Anglais',
          es: 'Inglés',
          it: 'Inglese',
        },
        'lang.german': {
          en: 'German',
          de: 'Deutsch',
          fr: 'Allemand',
          es: 'Alemán',
          it: 'Tedesco',
        },
        'lang.french': {
          en: 'French',
          de: 'Französisch',
          fr: 'Français',
          es: 'Francés',
          it: 'Francese',
        },
        'lang.spanish': {
          en: 'Spanish',
          de: 'Spanisch',
          fr: 'Espagnol',
          es: 'Español',
          it: 'Spagnolo',
        },
        'lang.italian': {
          en: 'Italian',
          de: 'Italienisch',
          fr: 'Italien',
          es: 'Italiano',
          it: 'Italiano',
        },
        'lang.portuguese': {
          en: 'Portuguese',
          de: 'Portugiesisch',
          fr: 'Portugais',
          es: 'Portugués',
          it: 'Portoghese',
        },
        'lang.russian': {
          en: 'Russian',
          de: 'Russisch',
          fr: 'Russe',
          es: 'Ruso',
          it: 'Russo',
        },
        'lang.chinese': {
          en: 'Chinese',
          de: 'Chinesisch',
          fr: 'Chinois',
          es: 'Chino',
          it: 'Cinese',
        },
        'lang.japanese': {
          en: 'Japanese',
          de: 'Japanisch',
          fr: 'Japonais',
          es: 'Japonés',
          it: 'Giapponese',
        },
        'lang.arabic': {
          en: 'Arabic',
          de: 'Arabisch',
          fr: 'Arabe',
          es: 'Árabe',
          it: 'Arabo',
        },
        'lang.dutch': {
          en: 'Dutch',
          de: 'Niederländisch',
          fr: 'Néerlandais',
          es: 'Neerlandés',
          it: 'Olandese',
        },
        'lang.polish': {
          en: 'Polish',
          de: 'Polnisch',
          fr: 'Polonais',
          es: 'Polaco',
          it: 'Polacco',
        },
        'lang.turkish': {
          en: 'Turkish',
          de: 'Türkisch',
          fr: 'Turc',
          es: 'Turco',
          it: 'Turco',
        },
        'lang.swedish': {
          en: 'Swedish',
          de: 'Schwedisch',
          fr: 'Suédois',
          es: 'Sueco',
          it: 'Svedese',
        },
        'lang.norwegian': {
          en: 'Norwegian',
          de: 'Norwegisch',
          fr: 'Norvégien',
          es: 'Noruego',
          it: 'Norvegese',
        },
        'lang.danish': {
          en: 'Danish',
          de: 'Dänisch',
          fr: 'Danois',
          es: 'Danés',
          it: 'Danese',
        },
        'lang.finnish': {
          en: 'Finnish',
          de: 'Finnisch',
          fr: 'Finnois',
          es: 'Finlandés',
          it: 'Finlandese',
        },
        'lang.greek': {
          en: 'Greek',
          de: 'Griechisch',
          fr: 'Grec',
          es: 'Griego',
          it: 'Greco',
        },
        'lang.czech': {
          en: 'Czech',
          de: 'Tschechisch',
          fr: 'Tchèque',
          es: 'Checo',
          it: 'Ceco',
        },
        'lang.hungarian': {
          en: 'Hungarian',
          de: 'Ungarisch',
          fr: 'Hongrois',
          es: 'Húngaro',
          it: 'Ungherese',
        },
        'lang.romanian': {
          en: 'Romanian',
          de: 'Rumänisch',
          fr: 'Roumain',
          es: 'Rumano',
          it: 'Rumeno',
        },
      };

      return translations[key]?.[lang] || translations[key]?.['en'] || key;
    });

    // Helper to normalize and translate language names
    // Usage: {{translateLang this.name @root.language}}
    Handlebars.registerHelper('translateLang', function (...args: unknown[]) {
      const options = args[args.length - 1] as Handlebars.HelperOptions;
      const languageName = args[0] as string;
      const passedLanguage = args.length > 2 ? args[1] : undefined;

      if (!languageName) return '';

      // Determine target language
      let lang: string;
      if (typeof passedLanguage === 'string' && passedLanguage) {
        lang = passedLanguage;
      } else if (options?.data?.root?.language) {
        lang = options.data.root.language as string;
      } else {
        lang = 'en';
      }

      // Normalize language name to translation key
      const normalized = languageName.toLowerCase().trim();
      let key = '';

      if (normalized === 'english' || normalized === 'englisch' || normalized === 'anglais' || normalized === 'inglés' || normalized === 'inglese') {
        key = 'lang.english';
      } else if (normalized === 'german' || normalized === 'deutsch' || normalized === 'allemand' || normalized === 'alemán' || normalized === 'tedesco') {
        key = 'lang.german';
      } else if (normalized === 'french' || normalized === 'französisch' || normalized === 'français' || normalized === 'francés' || normalized === 'francese') {
        key = 'lang.french';
      } else if (normalized === 'spanish' || normalized === 'spanisch' || normalized === 'espagnol' || normalized === 'español' || normalized === 'spagnolo') {
        key = 'lang.spanish';
      } else if (normalized === 'italian' || normalized === 'italienisch' || normalized === 'italien' || normalized === 'italiano') {
        key = 'lang.italian';
      } else if (normalized === 'portuguese' || normalized === 'portugiesisch' || normalized === 'portugais' || normalized === 'portugués' || normalized === 'portoghese') {
        key = 'lang.portuguese';
      } else if (normalized === 'russian' || normalized === 'russisch' || normalized === 'russe' || normalized === 'ruso' || normalized === 'russo') {
        key = 'lang.russian';
      } else if (normalized === 'chinese' || normalized === 'chinesisch' || normalized === 'chinois' || normalized === 'chino' || normalized === 'cinese') {
        key = 'lang.chinese';
      } else if (normalized === 'japanese' || normalized === 'japanisch' || normalized === 'japonais' || normalized === 'japonés' || normalized === 'giapponese') {
        key = 'lang.japanese';
      } else if (normalized === 'arabic' || normalized === 'arabisch' || normalized === 'arabe' || normalized === 'árabe' || normalized === 'arabo') {
        key = 'lang.arabic';
      } else if (normalized === 'dutch' || normalized === 'niederländisch' || normalized === 'néerlandais' || normalized === 'neerlandés' || normalized === 'olandese') {
        key = 'lang.dutch';
      } else if (normalized === 'polish' || normalized === 'polnisch' || normalized === 'polonais' || normalized === 'polaco' || normalized === 'polacco') {
        key = 'lang.polish';
      } else if (normalized === 'turkish' || normalized === 'türkisch' || normalized === 'turc' || normalized === 'turco') {
        key = 'lang.turkish';
      } else if (normalized === 'swedish' || normalized === 'schwedisch' || normalized === 'suédois' || normalized === 'sueco' || normalized === 'svedese') {
        key = 'lang.swedish';
      } else if (normalized === 'norwegian' || normalized === 'norwegisch' || normalized === 'norvégien' || normalized === 'noruego' || normalized === 'norvegese') {
        key = 'lang.norwegian';
      } else if (normalized === 'danish' || normalized === 'dänisch' || normalized === 'danois' || normalized === 'danés' || normalized === 'danese') {
        key = 'lang.danish';
      } else if (normalized === 'finnish' || normalized === 'finnisch' || normalized === 'finnois' || normalized === 'finlandés' || normalized === 'finlandese') {
        key = 'lang.finnish';
      } else if (normalized === 'greek' || normalized === 'griechisch' || normalized === 'grec' || normalized === 'griego' || normalized === 'greco') {
        key = 'lang.greek';
      } else if (normalized === 'czech' || normalized === 'tschechisch' || normalized === 'tchèque' || normalized === 'checo' || normalized === 'ceco') {
        key = 'lang.czech';
      } else if (normalized === 'hungarian' || normalized === 'ungarisch' || normalized === 'hongrois' || normalized === 'húngaro' || normalized === 'ungherese') {
        key = 'lang.hungarian';
      } else if (normalized === 'romanian' || normalized === 'rumänisch' || normalized === 'roumain' || normalized === 'rumano' || normalized === 'rumeno') {
        key = 'lang.romanian';
      } else {
        // Return original if not found
        return languageName;
      }

      // Translation mapping (reuse from 't' helper)
      const translations: Record<string, Record<string, string>> = {
        'lang.english': { en: 'English', de: 'Englisch', fr: 'Anglais', es: 'Inglés', it: 'Inglese' },
        'lang.german': { en: 'German', de: 'Deutsch', fr: 'Allemand', es: 'Alemán', it: 'Tedesco' },
        'lang.french': { en: 'French', de: 'Französisch', fr: 'Français', es: 'Francés', it: 'Francese' },
        'lang.spanish': { en: 'Spanish', de: 'Spanisch', fr: 'Espagnol', es: 'Español', it: 'Spagnolo' },
        'lang.italian': { en: 'Italian', de: 'Italienisch', fr: 'Italien', es: 'Italiano', it: 'Italiano' },
        'lang.portuguese': { en: 'Portuguese', de: 'Portugiesisch', fr: 'Portugais', es: 'Portugués', it: 'Portoghese' },
        'lang.russian': { en: 'Russian', de: 'Russisch', fr: 'Russe', es: 'Ruso', it: 'Russo' },
        'lang.chinese': { en: 'Chinese', de: 'Chinesisch', fr: 'Chinois', es: 'Chino', it: 'Cinese' },
        'lang.japanese': { en: 'Japanese', de: 'Japanisch', fr: 'Japonais', es: 'Japonés', it: 'Giapponese' },
        'lang.arabic': { en: 'Arabic', de: 'Arabisch', fr: 'Arabe', es: 'Árabe', it: 'Arabo' },
        'lang.dutch': { en: 'Dutch', de: 'Niederländisch', fr: 'Néerlandais', es: 'Neerlandés', it: 'Olandese' },
        'lang.polish': { en: 'Polish', de: 'Polnisch', fr: 'Polonais', es: 'Polaco', it: 'Polacco' },
        'lang.turkish': { en: 'Turkish', de: 'Türkisch', fr: 'Turc', es: 'Turco', it: 'Turco' },
        'lang.swedish': { en: 'Swedish', de: 'Schwedisch', fr: 'Suédois', es: 'Sueco', it: 'Svedese' },
        'lang.norwegian': { en: 'Norwegian', de: 'Norwegisch', fr: 'Norvégien', es: 'Noruego', it: 'Norvegese' },
        'lang.danish': { en: 'Danish', de: 'Dänisch', fr: 'Danois', es: 'Danés', it: 'Danese' },
        'lang.finnish': { en: 'Finnish', de: 'Finnisch', fr: 'Finnois', es: 'Finlandés', it: 'Finlandese' },
        'lang.greek': { en: 'Greek', de: 'Griechisch', fr: 'Grec', es: 'Griego', it: 'Greco' },
        'lang.czech': { en: 'Czech', de: 'Tschechisch', fr: 'Tchèque', es: 'Checo', it: 'Ceco' },
        'lang.hungarian': { en: 'Hungarian', de: 'Ungarisch', fr: 'Hongrois', es: 'Húngaro', it: 'Ungherese' },
        'lang.romanian': { en: 'Romanian', de: 'Rumänisch', fr: 'Roumain', es: 'Rumano', it: 'Rumeno' },
      };

      return translations[key]?.[lang] || translations[key]?.['en'] || languageName;
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
    this.logger.log(`[renderCoverLetter] Received targetJobTitle: ${data.targetJobTitle}`);
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

      // Locale mapping for date formatting
      const localeMap: Record<string, string> = {
        en: 'en-US',
        de: 'de-DE',
        fr: 'fr-FR',
        es: 'es-ES',
        it: 'it-IT',
      };

      // Closing phrase mapping
      const closingPhraseMap: Record<string, string> = {
        en: 'Sincerely,',
        de: 'Mit freundlichen Grüßen',
        fr: 'Cordialement,',
        es: 'Atentamente,',
        it: 'Cordiali saluti,',
      };

      // Use language from data (passed from export request) or template language
      const effectiveLanguage = data.language || language;

      // Set default values
      const templateData = {
        ...data,
        language: effectiveLanguage, // Add language to template data for 't' helper
        date:
          data.date ||
          new Date().toLocaleDateString(localeMap[effectiveLanguage] || 'en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }),
        closingPhrase: data.closingPhrase || closingPhraseMap[effectiveLanguage] || 'Sincerely,',
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
    this.logger.log(`[renderResume] Received targetJobTitle: ${data.targetJobTitle}`);
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

      // Use language from data (passed from export request) or template language
      const effectiveLanguage = data.language || language;

      // Add language to template data for 't' helper
      const templateData = { ...data, language: effectiveLanguage };
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
