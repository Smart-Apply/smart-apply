'use client';

import { useEffect, useRef, useMemo } from 'react';
import Handlebars from 'handlebars';
import { useTemplate, useResumeTemplates, useCoverLetterTemplates, getDefaultTemplate } from '@/hooks/use-templates';
import type { ResumeData } from '@/types';
import { Loader2 } from 'lucide-react';

// A4 width in pixels at 96 DPI (210mm ≈ 794px)
const A4_WIDTH_PX = 794;

// Extend Handlebars type for our custom flag
interface HandlebarsWithFlag {
  __helpersRegistered?: boolean;
}

// Register Handlebars helpers (same as backend)
function registerHandlebarsHelpers() {
  const hbs = Handlebars as typeof Handlebars & HandlebarsWithFlag;
  if (typeof window !== 'undefined' && !hbs.__helpersRegistered) {
    // Helper to convert string to lowercase
    Handlebars.registerHelper('toLowerCase', (str: string) => {
      return str ? str.toLowerCase().replace(/\s+/g, '-') : '';
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

    hbs.__helpersRegistered = true;
  }
}

interface ResumeTemplatePreviewProps {
  resume: ResumeData;
  templateId?: string | null;
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
}

/**
 * Renders resume content using the actual Handlebars template from the database.
 * If no templateId provided, loads and uses the default resume template.
 */
export function ResumeTemplatePreview({ resume, templateId }: ResumeTemplatePreviewProps) {
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
    email: resume.email,
    phone: resume.phone,
    linkedin: resume.linkedin,
    github: resume.github,
    location: resume.location,
    summary: resume.summary,
    skillCategories: resume.skillCategories?.map(cat => ({
      type: cat.type,
      skills: cat.skills,
    })),
    experiences: resume.experiences?.map(exp => ({
      title: exp.title,
      company: exp.company,
      location: exp.location,
      dateRange: exp.dateRange,
      achievements: exp.achievements,
    })),
    projects: resume.projects?.map(proj => ({
      name: proj.name,
      description: proj.description,
      date: proj.date,
      highlights: proj.highlights,
    })),
    education: resume.education?.map(edu => ({
      degree: edu.degree,
      institution: edu.institution,
      year: edu.year,
      fieldOfStudy: edu.fieldOfStudy,
      gpa: edu.gpa,
      description: edu.description,
    })),
    certifications: resume.certifications?.map(cert => ({
      name: cert.name,
      issuer: cert.issuer,
      date: cert.date,
    })),
  }), [resume]);

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
              transform: scale(var(--scale, 0.7));
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
              if (wrapper) {
                const containerWidth = document.body.clientWidth - 32; // subtract padding
                const scale = Math.min(containerWidth / ${A4_WIDTH_PX}, 1);
                wrapper.style.setProperty('--scale', scale);
                // Adjust body height to account for scaled content
                document.body.style.minHeight = (wrapper.scrollHeight * scale + 32) + 'px';
              }
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
    <div className="w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="bg-slate-100 px-3 py-2 border-b border-slate-200">
        <p className="text-xs font-medium text-slate-600">
          Template: <span className="text-slate-900">{template.name}</span>
          <span className="ml-2 text-slate-400">({template.category})</span>
          {isDefaultTemplate && <span className="ml-2 text-blue-600">(Standard)</span>}
        </p>
      </div>
      <div className="overflow-y-auto overflow-x-hidden" style={{ maxHeight: 'calc(100vh - 400px)' }}>
        <iframe
          ref={iframeRef}
          title="Resume Preview"
          className="w-full border-0"
          style={{ minHeight: '800px', background: '#f8fafc' }}
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
}: CoverLetterTemplatePreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  // Load all cover letter templates to find the default if no templateId is provided
  const { data: allTemplates, isLoading: templatesLoading } = useCoverLetterTemplates();
  const defaultTemplate = getDefaultTemplate(allTemplates);
  
  // Use provided templateId or fall back to default template's id
  const effectiveTemplateId = templateId || defaultTemplate?.id || '';
  const { data: template, isLoading: templateLoading, error } = useTemplate(effectiveTemplateId);
  
  const isLoading = templatesLoading || templateLoading;

  // Template data for cover letter
  const templateData = useMemo(() => ({
    candidateName,
    email,
    phone,
    location,
    linkedin,
    github,
    companyName,
    content: html,
    date: new Date().toLocaleDateString('de-DE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
  }), [html, candidateName, email, phone, location, linkedin, github, companyName]);

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
              transform: scale(var(--scale, 0.7));
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
              if (wrapper) {
                const containerWidth = document.body.clientWidth - 32;
                const scale = Math.min(containerWidth / ${A4_WIDTH_PX}, 1);
                wrapper.style.setProperty('--scale', scale);
                document.body.style.minHeight = (wrapper.scrollHeight * scale + 32) + 'px';
              }
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
    <div className="w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="bg-slate-100 px-3 py-2 border-b border-slate-200">
        <p className="text-xs font-medium text-slate-600">
          Template: <span className="text-slate-900">{template.name}</span>
          <span className="ml-2 text-slate-400">({template.category})</span>
          {isDefaultTemplate && <span className="ml-2 text-blue-600">(Standard)</span>}
        </p>
      </div>
      <div className="overflow-y-auto overflow-x-hidden" style={{ maxHeight: 'calc(100vh - 400px)' }}>
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
