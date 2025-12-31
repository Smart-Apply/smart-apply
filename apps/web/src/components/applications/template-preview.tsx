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

// Extend Handlebars type for our custom flag
interface HandlebarsWithFlag {
  __helpersRegistered?: boolean;
}

// Register Handlebars helpers (same as backend)
function registerHandlebarsHelpers() {
  const hbs = Handlebars as typeof Handlebars & HandlebarsWithFlag;
  if (typeof window !== 'undefined' && !hbs.__helpersRegistered) {
    // Helper to convert string to lowercase
    Handlebars.registerHelper('toLowerCase', (str: unknown) => {
      if (!str) return '';
      const text = typeof str === 'string' ? str : String(str);
      return text.toLowerCase().replace(/\s+/g, '-');
    });

    // Helper to convert newlines to <br> tags for HTML rendering
    Handlebars.registerHelper('nl2br', (text: unknown) => {
      if (!text) return '';
      // Handle SafeString or other objects
      const str = typeof text === 'string' ? text : (text as { toString(): string }).toString();
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
    // Usage: {{t "resume.summary" language}}
    Handlebars.registerHelper('t', function (this: unknown, key: string, language?: string) {
      // If language is not provided or is an object (Handlebars context), try to extract from @root
      if (!language || typeof language === 'object') {
        const context = this as Record<string, unknown>;
        language = (context?.language as string) || 'en';
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

    hbs.__helpersRegistered = true;
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

        // Adjust iframe height to content
        setTimeout(() => {
          if (doc.body) {
            iframe.style.height = `${doc.body.scrollHeight + 40}px`;
          }
        }, 100);
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
