import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import { PDFDocument } from 'pdf-lib';
import { ConfigService } from '../config/config.service';
import {
  TemplateRendererService,
  CoverLetterTemplateData,
  ResumeTemplateData,
} from './template-renderer.service';

export interface PdfGenerationOptions {
  template?: 'cover-letter' | 'resume';
  margin?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
  format?: 'A4' | 'Letter';
  atsOptimized?: boolean; // Use ATS-friendly template and styles
  metadata?: PdfMetadata; // PDF metadata for ATS compatibility
}

export interface PdfMetadata {
  title?: string; // PDF title (e.g., "Resume - John Doe" or "Cover Letter - Software Engineer")
  author?: string; // Author name (candidate name)
  subject?: string; // PDF subject (e.g., "Job Application")
  keywords?: string[]; // Keywords for ATS (e.g., ["JavaScript", "React", "Node.js"])
  creator?: string; // Creator (e.g., "Smart Apply")
}

@Injectable()
export class PdfService implements OnModuleDestroy {
  private readonly logger = new Logger(PdfService.name);
  private browser: puppeteer.Browser | null = null;
  private browserInitPromise: Promise<puppeteer.Browser> | null = null;

  constructor(
    private configService: ConfigService,
    private templateRenderer: TemplateRendererService,
  ) {}

  async onModuleDestroy() {
    if (this.browser) {
      await this.browser.close();
      this.logger.log('Puppeteer browser closed');
    }
  }

  private async initializeBrowser(): Promise<puppeteer.Browser> {
    if (this.browser) {
      return this.browser;
    }

    if (this.browserInitPromise) {
      return this.browserInitPromise;
    }

    this.browserInitPromise = this.launchBrowserWithRetry();

    try {
      this.browser = await this.browserInitPromise;
      this.logger.log('Puppeteer browser initialized');
      return this.browser;
    } catch (error) {
      this.logger.error('Failed to initialize Puppeteer browser', error);
      this.browserInitPromise = null;
      throw new Error(`Puppeteer initialization failed: ${error.message}`);
    }
  }

  private async launchBrowserWithRetry(): Promise<puppeteer.Browser> {
    const configs = [
      // Primary config with user-specified executable
      {
        headless: 'new' as const,
        executablePath: this.configService.puppeteerExecutablePath || undefined,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--disable-gpu',
          '--single-process', // Better for development
        ],
        timeout: 10000,
      },
      // Fallback config without custom executable (use bundled Chromium)
      {
        headless: 'new' as const,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--disable-gpu',
          '--single-process',
        ],
        timeout: 10000,
      },
      // Legacy fallback for older systems
      {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-web-security',
          '--single-process',
        ],
        timeout: 15000,
      },
    ];

    for (let i = 0; i < configs.length; i++) {
      try {
        this.logger.log(`Attempting browser launch with config ${i + 1}/${configs.length}`);
        const browser = await puppeteer.launch(configs[i]);
        this.logger.log(`Successfully launched browser with config ${i + 1}`);
        return browser;
      } catch (error) {
        this.logger.warn(`Browser launch config ${i + 1} failed: ${error.message}`);
        if (i === configs.length - 1) {
          throw error; // Last attempt failed
        }
      }
    }

    throw new Error('All browser launch configurations failed');
  }

  /**
   * Generate PDF from HTML string (legacy method - still supported)
   */
  async generatePDF(html: string, options: PdfGenerationOptions = {}): Promise<Buffer> {
    const browser = await this.initializeBrowser();
    const page = await browser.newPage();

    try {
      // Set HTML content
      await page.setContent(html, {
        waitUntil: 'networkidle0',
      });

      // Add CSS based on template (legacy behavior)
      if (options.template) {
        const css = this.getTemplateCSS(options.template);
        await page.addStyleTag({ content: css });
      }

      // Generate PDF
      const pdf = await page.pdf({
        format: options.format || 'A4',
        margin: options.margin || {
          top: '20mm',
          right: '20mm',
          bottom: '20mm',
          left: '20mm',
        },
        printBackground: true,
      });

      this.logger.log(`PDF generated successfully (${pdf.length} bytes)`);
      return Buffer.from(pdf);
    } catch (error) {
      this.logger.error('Failed to generate PDF', error);
      throw new Error(`PDF generation failed: ${error.message}`);
    } finally {
      await page.close();
    }
  }

  /**
   * Generate professional cover letter PDF from structured data
   */
  async generateCoverLetterPDF(
    data: CoverLetterTemplateData,
    templateId?: string,
    options: PdfGenerationOptions = {},
  ): Promise<Buffer> {
    try {
      const html = await this.templateRenderer.renderCoverLetter(data, templateId, options.atsOptimized);
      
      const pdfOptions: PdfGenerationOptions = {
        margin: options.atsOptimized ? {
          top: '0.5in',
          right: '0.5in',
          bottom: '0.5in',
          left: '0.5in',
        } : {
          top: '20mm',
          right: '25mm',
          bottom: '20mm',
          left: '25mm',
        },
        ...options,
      };

      const pdfBuffer = await this.generatePDFFromRenderedHTML(html, pdfOptions);

      // Add metadata if provided
      if (options.metadata) {
        return this.addMetadata(pdfBuffer, options.metadata);
      }

      return pdfBuffer;
    } catch (error) {
      this.logger.error('Failed to generate cover letter PDF', error);
      throw new Error(`Cover letter PDF generation failed: ${error.message}`);
    }
  }

  /**
   * Generate professional resume PDF from structured data
   */
  async generateResumePDF(
    data: ResumeTemplateData, 
    templateId?: string, 
    options: PdfGenerationOptions = {},
  ): Promise<Buffer> {
    try {
      const html = await this.templateRenderer.renderResume(data, templateId, options.atsOptimized);
      
      const pdfOptions: PdfGenerationOptions = {
        margin: options.atsOptimized ? {
          top: '0.5in',
          right: '0.5in',
          bottom: '0.5in',
          left: '0.5in',
        } : {
          top: '15mm',
          right: '20mm',
          bottom: '15mm',
          left: '20mm',
        },
        ...options,
      };

      const pdfBuffer = await this.generatePDFFromRenderedHTML(html, pdfOptions);

      // Add metadata if provided
      if (options.metadata) {
        return this.addMetadata(pdfBuffer, options.metadata);
      }

      return pdfBuffer;
    } catch (error) {
      this.logger.error('Failed to generate resume PDF', error);
      throw new Error(`Resume PDF generation failed: ${error.message}`);
    }
  }

  /**
   * Internal method to generate PDF from pre-rendered HTML with styles
   */
  private async generatePDFFromRenderedHTML(
    html: string,
    options: PdfGenerationOptions = {},
  ): Promise<Buffer> {
    const browser = await this.initializeBrowser();
    const page = await browser.newPage();

    try {
      // Set HTML content (already includes styles)
      await page.setContent(html, {
        waitUntil: 'networkidle0',
      });

      // Generate PDF with ATS-friendly options
      const pdfOptions: any = {
        format: options.format || 'A4',
        margin: options.margin || {
          top: '20mm',
          right: '20mm',
          bottom: '20mm',
          left: '20mm',
        },
        printBackground: options.atsOptimized ? false : true, // ATS-friendly: no backgrounds
        displayHeaderFooter: false, // ATS-friendly: no headers/footers
        preferCSSPageSize: false, // Use format setting
      };

      // ATS-optimized PDFs: Enable tagged PDF for accessibility/ATS
      if (options.atsOptimized) {
        pdfOptions.tagged = true; // UA accessibility (helps ATS)
        pdfOptions.outline = true; // Document outline for navigation
      }

      const pdf = await page.pdf(pdfOptions);

      this.logger.log(`PDF generated successfully (${pdf.length} bytes)${options.atsOptimized ? ' [ATS-optimized]' : ''}`);
      return Buffer.from(pdf);
    } catch (error) {
      this.logger.error('Failed to generate PDF from rendered HTML', error);
      throw new Error(`PDF generation failed: ${error.message}`);
    } finally {
      await page.close();
    }
  }

  /**
   * Add metadata to PDF for ATS compatibility
   */
  private async addMetadata(pdfBuffer: Buffer, metadata: PdfMetadata): Promise<Buffer> {
    try {
      // Load PDF
      const pdfDoc = await PDFDocument.load(pdfBuffer);

      // Default creator for all PDFs
      const DEFAULT_PDF_CREATOR = 'Smart Apply';

      // Set metadata fields
      if (metadata.title) {
        pdfDoc.setTitle(metadata.title);
      }
      if (metadata.author) {
        pdfDoc.setAuthor(metadata.author);
      }
      if (metadata.subject) {
        pdfDoc.setSubject(metadata.subject);
      }
      if (metadata.keywords && metadata.keywords.length > 0) {
        pdfDoc.setKeywords(metadata.keywords);
      }
      // Set creator (use provided value or default)
      pdfDoc.setCreator(metadata.creator || DEFAULT_PDF_CREATOR);

      // Set creation and modification dates
      const now = new Date();
      pdfDoc.setCreationDate(now);
      pdfDoc.setModificationDate(now);

      // Save and return
      const pdfBytes = await pdfDoc.save();
      this.logger.log(`PDF metadata added: ${metadata.title || 'Untitled'}`);
      return Buffer.from(pdfBytes);
    } catch (error) {
      this.logger.error('Failed to add PDF metadata', error);
      throw new Error(`PDF metadata injection failed: ${error.message}`);
    }
  }

  private getTemplateCSS(template: 'cover-letter' | 'resume'): string {
    // Base styles + template-specific styles
    const baseCSS = this.getBaseCSS();
    const templateCSS =
      template === 'cover-letter' ? this.getCoverLetterCSS() : this.getResumeCSS();

    return `${baseCSS}\n${templateCSS}`;
  }

  private getBaseCSS(): string {
    return `
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      
      body {
        font-family: 'Arial', 'Helvetica', sans-serif;
        font-size: 11pt;
        line-height: 1.6;
        color: #333;
      }
      
      h1 {
        font-size: 18pt;
        font-weight: bold;
        margin-bottom: 8pt;
      }
      
      h2 {
        font-size: 14pt;
        font-weight: bold;
        margin-top: 12pt;
        margin-bottom: 6pt;
        border-bottom: 1px solid #ddd;
        padding-bottom: 4pt;
      }
      
      h3 {
        font-size: 12pt;
        font-weight: bold;
        margin-top: 8pt;
        margin-bottom: 4pt;
      }
      
      p {
        margin-bottom: 8pt;
      }
      
      ul {
        margin-left: 20pt;
        margin-bottom: 8pt;
      }
      
      li {
        margin-bottom: 4pt;
      }
      
      strong {
        font-weight: bold;
      }
      
      a {
        color: #0066cc;
        text-decoration: none;
      }
    `;
  }

  private getCoverLetterCSS(): string {
    return `
      .header {
        text-align: center;
        margin-bottom: 20pt;
        padding-bottom: 10pt;
        border-bottom: 2px solid #333;
      }
      
      .header h1 {
        margin-bottom: 4pt;
      }
      
      .header .contact {
        font-size: 10pt;
        color: #666;
      }
      
      .date {
        margin-bottom: 12pt;
        font-size: 10pt;
      }
      
      .recipient {
        margin-bottom: 16pt;
      }
      
      .salutation {
        margin-bottom: 12pt;
      }
      
      .body-text {
        text-align: justify;
      }
      
      .closing {
        margin-top: 20pt;
      }
    `;
  }

  private getResumeCSS(): string {
    return `
      .header {
        text-align: center;
        margin-bottom: 16pt;
        padding-bottom: 8pt;
        border-bottom: 2px solid #333;
      }
      
      .section {
        margin-bottom: 12pt;
        page-break-inside: avoid;
      }
      
      .section-title {
        font-size: 13pt;
        font-weight: bold;
        color: #0066cc;
        margin-bottom: 8pt;
        border-bottom: 1px solid #0066cc;
        padding-bottom: 4pt;
      }
      
      .experience-item,
      .project-item {
        margin-bottom: 10pt;
        page-break-inside: avoid;
      }
      
      .item-header {
        display: flex;
        justify-content: space-between;
        margin-bottom: 4pt;
      }
      
      .item-title {
        font-weight: bold;
        font-size: 11pt;
      }
      
      .item-date {
        font-size: 10pt;
        color: #666;
      }
      
      .item-company {
        font-style: italic;
        color: #666;
        margin-bottom: 4pt;
      }
      
      .skills-list {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8pt;
      }
      
      .skill-category {
        margin-bottom: 8pt;
      }
      
      .skill-category strong {
        display: block;
        margin-bottom: 2pt;
        color: #0066cc;
      }
    `;
  }

  /**
   * Health check - try to initialize browser without throwing
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.initializeBrowser();
      return true;
    } catch (error) {
      this.logger.warn('PDF service health check failed', error.message);
      return false;
    }
  }
}
