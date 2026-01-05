'use client';

import { useEffect, useRef, useMemo } from 'react';
import Handlebars from 'handlebars';
import { useTemplate, useResumeTemplates, useCoverLetterTemplates, getDefaultTemplate } from '@/hooks/use-templates';
import type { ResumeData } from '@/types';
import { Loader2 } from 'lucide-react';

// A4 width in pixels at 96 DPI (210mm ≈ 794px)
const A4_WIDTH_PX = 794;
// A4 height in pixels at 96 DPI (297mm ≈ 1123px)
const A4_HEIGHT_PX = 1123;

/**
 * Normalize proficiency level to translation key
 * Maps various user input formats to standardized translation keys (e.g., "level.native")
 * @param level - User input level string (e.g., "Muttersprache", "Native", "fließend")
 * @returns Normalized translation key (e.g., "level.native") or original value if no match
 */
function normalizeProficiencyLevel(level: string | undefined): string | undefined {
  if (!level) return undefined;
  
  // If already normalized (starts with "level."), return as-is
  if (level.startsWith('level.')) return level;

  const normalized = level.toLowerCase().trim();

  // Native language variants
  if (
    normalized === 'muttersprache' ||
    normalized === 'native' ||
    normalized === 'native speaker' ||
    normalized === 'muttersprachlich' ||
    normalized === 'langue maternelle' ||
    normalized === 'madrelingua' ||
    normalized === 'nativo'
  ) {
    return 'level.native';
  }

  // Fluent variants
  if (
    normalized === 'fließend' ||
    normalized === 'fliessend' ||
    normalized === 'fluent' ||
    normalized === 'verhandlungssicher' ||
    normalized === 'courant' ||
    normalized === 'fluido' ||
    normalized === 'fluente'
  ) {
    return 'level.fluent';
  }

  // Advanced variants
  if (
    normalized === 'fortgeschritten' ||
    normalized === 'advanced' ||
    normalized === 'avancé' ||
    normalized === 'avanzado' ||
    normalized === 'avanzato'
  ) {
    return 'level.advanced';
  }

  // Good variants
  if (
    normalized === 'gut' ||
    normalized === 'good' ||
    normalized === 'sehr gut' ||
    normalized === 'very good' ||
    normalized === 'gute kenntnisse' ||
    normalized === 'bon' ||
    normalized === 'bueno' ||
    normalized === 'buono'
  ) {
    return 'level.good';
  }

  // Intermediate variants
  if (
    normalized === 'mittelstufe' ||
    normalized === 'intermediate' ||
    normalized === 'mittel' ||
    normalized === 'intermédiaire' ||
    normalized === 'intermedio'
  ) {
    return 'level.intermediate';
  }

  // Conversational variants
  if (
    normalized === 'konversationssicher' ||
    normalized === 'conversational' ||
    normalized === 'conversationnel' ||
    normalized === 'conversacional' ||
    normalized === 'conversazionale'
  ) {
    return 'level.conversational';
  }

  // Basic variants
  if (
    normalized === 'grundkenntnisse' ||
    normalized === 'basic' ||
    normalized === 'basics' ||
    normalized === 'notions de base' ||
    normalized === 'básico' ||
    normalized === 'base'
  ) {
    return 'level.basic';
  }

  // Beginner variants
  if (
    normalized === 'anfänger' ||
    normalized === 'beginner' ||
    normalized === 'débutant' ||
    normalized === 'principiante'
  ) {
    return 'level.beginner';
  }

  // Return original if no match found (allows custom levels)
  return level;
}

// Extend Handlebars type for our custom flag
interface HandlebarsWithFlag {
  __helpersRegistered?: boolean;
  __helpersVersion?: number;
}

// Helper version - increment this to force re-registration after changes
const HELPERS_VERSION = 3;

// Register Handlebars helpers (same as backend)
function registerHandlebarsHelpers() {
  const hbs = Handlebars as typeof Handlebars & HandlebarsWithFlag;
  // Re-register if version changed or not registered yet
  if (typeof window !== 'undefined' && (!hbs.__helpersRegistered || hbs.__helpersVersion !== HELPERS_VERSION)) {
    // Helper to convert string to lowercase
    Handlebars.registerHelper('toLowerCase', (str: unknown) => {
      if (!str) return '';
      const text = typeof str === 'string' ? str : String(str);
      return text.toLowerCase().replace(/\s+/g, '-');
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
    Handlebars.registerHelper('ifCond', function (this: unknown, v1: unknown, operator: string, v2: unknown, options: Handlebars.HelperOptions) {
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
          return (v1 as number) < (v2 as number) ? options.fn(this) : options.inverse(this);
        case '<=':
          return (v1 as number) <= (v2 as number) ? options.fn(this) : options.inverse(this);
        case '>':
          return (v1 as number) > (v2 as number) ? options.fn(this) : options.inverse(this);
        case '>=':
          return (v1 as number) >= (v2 as number) ? options.fn(this) : options.inverse(this);
        default:
          return options.inverse(this);
      }
    });

    // Format date helper - formats ISO date strings to readable format
    Handlebars.registerHelper('formatDate', function (this: unknown, dateString: string, language?: string) {
      if (!dateString) return '';
      
      try {
        const date = new Date(dateString);
        const lang = (typeof language === 'string' ? language : 'en') || 'en';
        
        const monthNames: Record<string, string[]> = {
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
    Handlebars.registerHelper('t', function (this: unknown, key: string, ...args: unknown[]) {
      // Handlebars always passes options as the last argument
      const options = args[args.length - 1] as Handlebars.HelperOptions;
      const passedLanguage = args.length > 1 ? args[0] : undefined;
      
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
    Handlebars.registerHelper('translateLang', function (this: unknown, languageName: string, ...args: unknown[]) {
      const options = args[args.length - 1] as Handlebars.HelperOptions;
      const passedLanguage = args.length > 1 ? args[0] : undefined;

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

    hbs.__helpersRegistered = true;
    hbs.__helpersVersion = HELPERS_VERSION;
  }
}

interface ResumeTemplatePreviewProps {
  resume: ResumeData;
  templateId?: string | null;
  language?: 'de' | 'en' | 'fr' | 'es' | 'it';
}

interface CoverLetterTemplatePreviewProps {
  html: string;
  candidateName?: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  github?: string;
  companyName?: string;
  templateId?: string | null;
  language?: 'de' | 'en' | 'fr' | 'es' | 'it';
}

/**
 * Renders resume content using the actual Handlebars template from the database.
 * If no templateId provided, loads and uses the default resume template.
 */
export function ResumeTemplatePreview({ resume, templateId, language = 'en' }: ResumeTemplatePreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  // Load all resume templates to find the default if no templateId is provided
  const { data: allTemplates, isLoading: templatesLoading } = useResumeTemplates();
  const defaultTemplate = getDefaultTemplate(allTemplates);
  
  // Use provided templateId or fall back to default template's id
  const effectiveTemplateId = templateId || defaultTemplate?.id || '';
  const { data: template, isLoading: templateLoading, error } = useTemplate(effectiveTemplateId);
  
  const isLoading = templatesLoading || templateLoading;

  // Transform ResumeData to match Handlebars template format
  const templateData = useMemo(() => ({
    candidateName: resume.candidateName || 'Dein Name',
    targetJobTitle: resume.targetJobTitle,
    email: resume.email,
    phone: resume.phone,
    linkedin: resume.linkedin,
    github: resume.github,
    location: resume.location,
    // Wrap summary in SafeString to render HTML formatting
    summary: resume.summary ? new Handlebars.SafeString(resume.summary) : undefined,
    language, // Use selected language from prop
    skillCategories: resume.skillCategories?.map(cat => ({
      type: cat.type,
      skills: cat.skills,
    })),
    experiences: resume.experiences?.map(exp => ({
      title: exp.title,
      company: exp.company,
      location: exp.location,
      dateRange: exp.dateRange,
      // Include startDate and endDate for templates that use formatDate helper
      startDate: exp.startDate,
      endDate: exp.endDate,
      // Wrap description in SafeString to render HTML formatting
      description: exp.description ? new Handlebars.SafeString(exp.description) : undefined,
      achievements: exp.achievements,
    })),
    projects: resume.projects?.map(proj => ({
      name: proj.name,
      // Wrap description in SafeString to render HTML formatting
      description: proj.description ? new Handlebars.SafeString(proj.description) : undefined,
      date: proj.date,
      highlights: proj.highlights,
    })),
    education: resume.education?.map(edu => ({
      degree: edu.degree,
      institution: edu.institution,
      year: edu.year,
      fieldOfStudy: edu.fieldOfStudy,
      gpa: edu.gpa,
      // Wrap description in SafeString to render HTML formatting
      description: edu.description ? new Handlebars.SafeString(edu.description) : undefined,
    })),
    certifications: resume.certifications?.map(cert => ({
      name: cert.name,
      issuer: cert.issuer,
      date: cert.date,
    })),
    // Include languages with normalized level for translation
    // Normalize proficiency levels to translation keys (e.g., "Muttersprache" -> "level.native")
    languages: resume.languages?.map(lang => ({
      name: lang.name,
      level: normalizeProficiencyLevel(lang.level),
      proficiency: normalizeProficiencyLevel(lang.level), // Alias for templates that use 'proficiency'
    })),
  }), [resume, language]);

  // Render template when data changes
  useEffect(() => {
    if (!iframeRef.current || !template) return;

    registerHandlebarsHelpers();

    try {
      const compiledTemplate = Handlebars.compile(template.htmlTemplate);
      const renderedHtml = compiledTemplate(templateData);

      // Wrap with CSS - scale PDF to fit container width
      const fullHtml = `
        <!DOCTYPE html>
        <html lang="de">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            /* Reset for iframe */
            * { box-sizing: border-box; }
            html, body { 
              margin: 0; 
              padding: 0;
              overflow-x: hidden;
            }
            
            /* Template CSS */
            ${template.cssStyles}
            
            /* Preview container that scales to fit */
            .preview-scale-wrapper {
              width: ${A4_WIDTH_PX}px;
              transform-origin: top left;
              transform: scale(var(--scale, 1));
            }
            
            /* Preview adjustments */
            body {
              background: #f8fafc;
              padding: 16px;
              overflow-x: hidden;
            }
            
            /* Handle long strings without spaces */
            .preview-scale-wrapper * {
              word-break: break-word;
              overflow-wrap: anywhere;
            }
            
            /* A4 page simulation */
            .preview-scale-wrapper > * {
              background: white;
              box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }
          </style>
        </head>
        <body>
          <div class="preview-scale-wrapper">
            ${renderedHtml.replace(/<html[^>]*>|<\/html>|<head>[\s\S]*<\/head>|<body[^>]*>|<\/body>/gi, '')}
          </div>
          <script>
            function updateScale() {
              const wrapper = document.querySelector('.preview-scale-wrapper');
              if (!wrapper) return;

              // Use actual iframe container width (the full width available in the right panel)
              const availableWidth = document.body.clientWidth - 32;
              
              // Scale only based on width - allow content to flow naturally for multiple pages
              const scale = Math.min(availableWidth / ${A4_WIDTH_PX}, 1.0);

              wrapper.style.setProperty('--scale', String(scale));
              // Adjust body height to account for scaled content (full height, not constrained)
              document.body.style.minHeight = (wrapper.scrollHeight * scale + 32) + 'px';
            }
            updateScale();
            window.addEventListener('resize', updateScale);
            // Re-calculate after fonts and images load
            setTimeout(updateScale, 100);
          </script>
        </body>
        </html>
      `;

      const iframe = iframeRef.current;
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(fullHtml);
        doc.close();

        // Adjust iframe height to content - multiple checks for accurate height
        const updateIframeHeight = () => {
          if (doc.body) {
            const wrapper = doc.querySelector('.preview-scale-wrapper') as HTMLElement;
            const scale = parseFloat(wrapper?.style.getPropertyValue('--scale') || '1');
            const contentHeight = wrapper ? wrapper.scrollHeight * scale : doc.body.scrollHeight;
            // Add extra padding for multi-page content
            iframe.style.height = `${Math.max(contentHeight + 80, doc.body.scrollHeight + 60)}px`;
          }
        };
        // Run multiple times to catch dynamic content
        setTimeout(updateIframeHeight, 100);
        setTimeout(updateIframeHeight, 300);
        setTimeout(updateIframeHeight, 600);
      }
    } catch (err) {
      console.error('Template rendering failed:', err);
    }
  }, [template, templateData]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 bg-slate-50 rounded-lg">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        <span className="ml-2 text-sm text-slate-500">Template wird geladen...</span>
      </div>
    );
  }

  if (error || !template) {
    return (
      <div className="flex items-center justify-center h-64 bg-red-50 rounded-lg border border-red-200">
        <p className="text-sm text-red-600">Template konnte nicht geladen werden</p>
      </div>
    );
  }

  const isDefaultTemplate = !templateId && defaultTemplate?.id === template.id;

  return (
    <div className="w-full rounded-lg border border-slate-200 bg-white shadow-sm flex flex-col">
      <div className="bg-slate-100 px-3 py-2 border-b border-slate-200 shrink-0">
        <p className="text-xs font-medium text-slate-600">
          Template: <span className="text-slate-900">{template.name}</span>
          <span className="ml-2 text-slate-400">({template.category})</span>
          {isDefaultTemplate && <span className="ml-2 text-blue-600">(Standard)</span>}
        </p>
      </div>
      <div className="flex-1 min-h-0">
        <iframe
          ref={iframeRef}
          title="Resume Preview"
          className="w-full border-0"
          style={{ background: '#f8fafc', minHeight: '800px' }}
          sandbox="allow-same-origin allow-scripts"
        />
      </div>
    </div>
  );
}

/**
 * Renders cover letter content using the actual Handlebars template from the database.
 * If no templateId provided, loads and uses the default cover letter template.
 */
export function CoverLetterTemplatePreview({
  html,
  candidateName = 'Dein Name',
  email,
  phone,
  location,
  linkedin,
  github,
  companyName,
  templateId,
  language = 'en',
}: CoverLetterTemplatePreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  // Load all cover letter templates to find the default if no templateId is provided
  const { data: allTemplates, isLoading: templatesLoading } = useCoverLetterTemplates();
  const defaultTemplate = getDefaultTemplate(allTemplates);
  
  // Use provided templateId or fall back to default template's id
  const effectiveTemplateId = templateId || defaultTemplate?.id || '';
  const { data: template, isLoading: templateLoading, error } = useTemplate(effectiveTemplateId);
  
  const isLoading = templatesLoading || templateLoading;

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

  // Template data for cover letter
  const templateData = useMemo(() => ({
    candidateName,
    email,
    phone,
    location,
    linkedin,
    github,
    companyName,
    // Wrap content in SafeString to ensure HTML is not escaped by Handlebars
    // This is critical - even with {{{content}}}, Handlebars needs to know this is safe HTML
    content: new Handlebars.SafeString(html || ''),
    language, // Use selected language from prop
    closingPhrase: closingPhraseMap[language] || closingPhraseMap.en,
    date: new Date().toLocaleDateString(localeMap[language] || 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
  }), [html, candidateName, email, phone, location, linkedin, github, companyName, language]);

  // Render template when data changes
  useEffect(() => {
    if (!iframeRef.current || !template) return;

    registerHandlebarsHelpers();

    try {
      // Debug: Log the content being passed to template
      const contentString = html || '';
      console.log('📄 CoverLetter Preview - Input:', {
        contentLength: contentString.length,
        contentPreview: contentString.substring(0, 200),
        hasHtmlTags: /<[^>]+>/.test(contentString),
      });

      const compiledTemplate = Handlebars.compile(template.htmlTemplate);
      const renderedHtml = compiledTemplate(templateData);
      
      // Debug: Log rendered HTML to check if content is escaped
      console.log('📄 CoverLetter Preview - Rendered:', {
        renderedLength: renderedHtml.length,
        renderedPreview: renderedHtml.substring(0, 500),
        hasEscapedTags: /&lt;|&gt;/.test(renderedHtml),
      });

      // Wrap with CSS - scale PDF to fit container width
      const fullHtml = `
        <!DOCTYPE html>
        <html lang="de">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            /* Reset for iframe */
            * { box-sizing: border-box; }
            html, body { 
              margin: 0; 
              padding: 0;
              overflow-x: hidden;
            }
            
            /* Template CSS */
            ${template.cssStyles}
            
            /* Enhanced list styling for proper rendering */
            ul {
              list-style-type: disc !important;
              margin-left: 20pt !important;
              margin-bottom: 10pt !important;
              padding-left: 0 !important;
            }
            
            ol {
              list-style-type: decimal !important;
              margin-left: 20pt !important;
              margin-bottom: 10pt !important;
              padding-left: 0 !important;
            }
            
            li {
              margin-bottom: 4pt !important;
              padding-left: 4pt !important;
              display: list-item !important;
            }
            
            li p {
              margin: 0 !important;
              display: inline !important;
            }
            
            /* Ensure block elements don't break list rendering */
            .body-content ul,
            .body-content ol {
              margin-top: 8pt;
              margin-bottom: 12pt;
            }
            
            /* Preview container that scales to fit */
            .preview-scale-wrapper {
              width: ${A4_WIDTH_PX}px;
              transform-origin: top left;
              transform: scale(var(--scale, 1));
            }
            
            /* Preview adjustments */
            body {
              background: #f8fafc;
              padding: 16px;
              overflow-x: hidden;
            }
            
            /* Handle long strings without spaces */
            .preview-scale-wrapper * {
              word-break: break-word;
              overflow-wrap: anywhere;
            }
            
            /* A4 page simulation */
            .preview-scale-wrapper > * {
              background: white;
              box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }
          </style>
        </head>
        <body>
          <div class="preview-scale-wrapper">
            ${renderedHtml.replace(/<html[^>]*>|<\/html>|<head>[\s\S]*<\/head>|<body[^>]*>|<\/body>/gi, '')}
          </div>
          <script>
            function updateScale() {
              const wrapper = document.querySelector('.preview-scale-wrapper');
              if (!wrapper) return;

              // Use actual iframe container width (the full width available in the right panel)
              const availableWidth = document.body.clientWidth - 32;
              
              // Available height: window height minus minimal spacing
              const availableHeight = window.innerHeight - 60;

              const scaleWidth = availableWidth / ${A4_WIDTH_PX};
              const scaleHeight = availableHeight / ${A4_HEIGHT_PX};

              const scale = Math.min(scaleWidth, scaleHeight, 1.2);

              wrapper.style.setProperty('--scale', String(scale));
              // Adjust body height to account for scaled content
              document.body.style.minHeight = (wrapper.scrollHeight * scale + 32) + 'px';
            }
            updateScale();
            window.addEventListener('resize', updateScale);
          </script>
        </body>
        </html>
      `;

      const iframe = iframeRef.current;
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(fullHtml);
        doc.close();

        setTimeout(() => {
          if (doc.body) {
            iframe.style.height = `${doc.body.scrollHeight + 40}px`;
          }
        }, 100);
      }
    } catch (err) {
      console.error('Cover letter template rendering failed:', err);
    }
  }, [template, templateData]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 bg-slate-50 rounded-lg">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        <span className="ml-2 text-sm text-slate-500">Template wird geladen...</span>
      </div>
    );
  }

  if (error || !template) {
    return (
      <div className="flex items-center justify-center h-64 bg-red-50 rounded-lg border border-red-200">
        <p className="text-sm text-red-600">Template konnte nicht geladen werden</p>
      </div>
    );
  }

  const isDefaultTemplate = !templateId && defaultTemplate?.id === template.id;

  if (!html || !html.trim()) {
    return (
      <div className="w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="bg-slate-100 px-3 py-2 border-b border-slate-200">
          <p className="text-xs font-medium text-slate-600">
            Template: <span className="text-slate-900">{template.name}</span>
            {isDefaultTemplate && <span className="ml-2 text-blue-600">(Standard)</span>}
          </p>
        </div>
        <div className="flex items-center justify-center h-64 bg-slate-50">
          <p className="text-sm text-slate-500">Noch kein Anschreiben vorhanden</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full rounded-lg border border-slate-200 bg-white shadow-sm flex flex-col">
      <div className="bg-slate-100 px-3 py-2 border-b border-slate-200 flex-shrink-0">
        <p className="text-xs font-medium text-slate-600">
          Template: <span className="text-slate-900">{template.name}</span>
          <span className="ml-2 text-slate-400">({template.category})</span>
          {isDefaultTemplate && <span className="ml-2 text-blue-600">(Standard)</span>}
        </p>
      </div>
      <div className="flex-1 min-h-0">
        <iframe
          ref={iframeRef}
          title="Cover Letter Preview"
          className="w-full border-0"
          style={{ minHeight: '800px', background: '#f8fafc' }}
          sandbox="allow-same-origin allow-scripts"
        />
      </div>
    </div>
  );
}
