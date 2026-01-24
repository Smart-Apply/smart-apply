import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import { Browser } from 'puppeteer';
import { PDFDocument } from 'pdf-lib';
import { createPool, Pool } from 'generic-pool';
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
export class PdfService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PdfService.name);
  private browserPool: Pool<Browser>;
  private poolMetrics = {
    totalAcquires: 0,
    totalReleases: 0,
    currentlyAcquired: 0,
    totalErrors: 0,
  };

  constructor(
    private configService: ConfigService,
    private templateRenderer: TemplateRendererService,
  ) {}

  async onModuleInit() {
    this.logger.log('Initializing browser pool...');
    this.browserPool = createPool(
      {
        create: async () => {
          this.logger.debug('Creating new browser instance...');
          const browser = await this.launchBrowserWithRetry();
          this.logger.debug(`Browser created (PID: ${browser.process()?.pid || 'unknown'})`);
          return browser;
        },
        destroy: async (browser) => {
          this.logger.debug(`Destroying browser (PID: ${browser.process()?.pid || 'unknown'})...`);
          await browser.close();
          this.logger.debug('Browser destroyed');
        },
        validate: async (browser) => {
          // Check if browser is still connected
          return browser.isConnected();
        },
      },
      {
        max: this.configService.puppeteerMaxBrowsers,
        min: this.configService.puppeteerMinBrowsers,
        idleTimeoutMillis: this.configService.puppeteerIdleTimeoutMs,
        evictionRunIntervalMillis: this.configService.puppeteerEvictionIntervalMs,
        testOnBorrow: true, // Validate browser before use
        acquireTimeoutMillis: 60000, // Wait up to 60s for a browser (increased from 30s)
      },
    );

    this.logger.log(
      `Browser pool initialized (min: ${this.configService.puppeteerMinBrowsers}, max: ${this.configService.puppeteerMaxBrowsers})`,
    );

    // Log pool metrics every 30 seconds in development
    if (this.configService.isDevelopment) {
      setInterval(() => {
        this.logPoolMetrics();
      }, 30000);
    }
  }

  async onModuleDestroy() {
    if (this.browserPool) {
      this.logger.log('Draining browser pool...');
      await this.browserPool.drain();
      await this.browserPool.clear();
      this.logger.log('Browser pool closed');
    }
  }

  private logPoolMetrics() {
    const poolSize = this.browserPool.size;
    const available = this.browserPool.available;
    const pending = this.browserPool.pending;
    const borrowed = this.browserPool.borrowed;

    const utilization = poolSize > 0 ? ((borrowed / poolSize) * 100).toFixed(1) : '0.0';

    this.logger.debug(
      `Pool Metrics: size=${poolSize}, available=${available}, borrowed=${borrowed}, ` +
        `pending=${pending}, utilization=${utilization}%, acquires=${this.poolMetrics.totalAcquires}, ` +
        `releases=${this.poolMetrics.totalReleases}, errors=${this.poolMetrics.totalErrors}`,
    );
  }

  private async acquireBrowser(): Promise<Browser> {
    try {
      this.poolMetrics.totalAcquires++;
      this.poolMetrics.currentlyAcquired++;

      // Log pool status before acquire attempt
      const poolStatus = {
        size: this.browserPool.size,
        available: this.browserPool.available,
        borrowed: this.browserPool.borrowed,
        pending: this.browserPool.pending,
      };
      this.logger.debug(`Acquiring browser... Pool status: ${JSON.stringify(poolStatus)}`);

      const browser = await this.browserPool.acquire();

      // Log pool metrics after acquire
      if (this.configService.isDevelopment) {
        this.logPoolMetrics();
      }

      return browser;
    } catch (error) {
      this.poolMetrics.totalErrors++;
      this.poolMetrics.currentlyAcquired--;
      
      // Log detailed error info
      const poolStatus = {
        size: this.browserPool.size,
        available: this.browserPool.available,
        borrowed: this.browserPool.borrowed,
        pending: this.browserPool.pending,
      };
      this.logger.error(
        `Failed to acquire browser from pool. Status: ${JSON.stringify(poolStatus)}`,
        error,
      );
      
      throw new Error(`Browser pool exhausted: ${error.message}`);
    }
  }

  private async releaseBrowser(browser: Browser) {
    try {
      this.poolMetrics.totalReleases++;
      this.poolMetrics.currentlyAcquired--;

      await this.browserPool.release(browser);

      // Log pool metrics after release
      if (this.configService.isDevelopment) {
        this.logPoolMetrics();
      }
    } catch (error) {
      this.poolMetrics.totalErrors++;
      this.logger.error('Failed to release browser to pool', error);
      // Don't throw - this is cleanup, we want to continue
    }
  }

  private async initializeBrowser(): Promise<puppeteer.Browser> {
    // Legacy method - now uses pool
    return this.acquireBrowser();
  }

  private async launchBrowserWithRetry(): Promise<puppeteer.Browser> {
    const configs = [
      // Primary config with user-specified executable (production)
      {
        headless: true,
        executablePath: this.configService.puppeteerExecutablePath || undefined,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--disable-gpu',
          '--disable-software-rasterizer',
          '--no-zygote', // Required for newer Chromium in Docker
          '--disable-extensions',
          '--disable-background-networking',
          '--disable-sync',
          '--metrics-recording-only',
          '--disable-default-apps',
          '--mute-audio',
          '--no-first-run',
        ],
        timeout: 30000,
      },
      // Fallback config without custom executable (use bundled Chromium)
      {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--disable-gpu',
          '--disable-software-rasterizer',
          '--no-zygote',
        ],
        timeout: 30000,
      },
      // Legacy fallback for older systems
      {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-web-security',
          '--disable-gpu',
          '--no-zygote',
        ],
        timeout: 30000,
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
    const browser = await this.acquireBrowser();

    try {
      const page = await browser.newPage();

      // Increase navigation timeout
      page.setDefaultNavigationTimeout(120000); // 2 minutes
      page.setDefaultTimeout(120000); // 2 minutes

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
    } finally {
      // Always release browser back to pool
      await this.releaseBrowser(browser);
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
      const html = await this.templateRenderer.renderCoverLetter(
        data,
        templateId,
        options.atsOptimized,
      );

      const pdfOptions: PdfGenerationOptions = {
        margin: options.atsOptimized
          ? {
              top: '0.5in',
              right: '0.5in',
              bottom: '0.5in',
              left: '0.5in',
            }
          : {
              top: '0mm',
              right: '0mm',
              bottom: '0mm',
              left: '0mm',
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
        margin: options.atsOptimized
          ? {
              top: '0.5in',
              right: '0.5in',
              bottom: '0.5in',
              left: '0.5in',
            }
          : {
              top: '0mm',
              right: '0mm',
              bottom: '0mm',
              left: '0mm',
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
    const browser = await this.acquireBrowser();

    try {
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

        this.logger.log(
          `PDF generated successfully (${pdf.length} bytes)${options.atsOptimized ? ' [ATS-optimized]' : ''}`,
        );
        return Buffer.from(pdf);
      } catch (error) {
        this.logger.error('Failed to generate PDF from rendered HTML', error);
        throw new Error(`PDF generation failed: ${error.message}`);
      } finally {
        await page.close();
      }
    } finally {
      // Always release browser back to pool
      await this.releaseBrowser(browser);
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
   * Generate PNG screenshot from HTML using the browser pool
   * Used for template previews
   */
  async generateScreenshot(
    html: string,
    options: { width?: number; height?: number; fullPage?: boolean } = {},
  ): Promise<Buffer> {
    const browser = await this.acquireBrowser();

    try {
      const page = await browser.newPage();
      page.setDefaultNavigationTimeout(60000); // 1 minute
      page.setDefaultTimeout(60000); // 1 minute

      try {
        // Set viewport to A4 dimensions at 72 DPI by default
        await page.setViewport({
          width: options.width || 595,
          height: options.height || 842,
        });

        await page.setContent(html, {
          waitUntil: 'networkidle0',
          timeout: 60000,
        });

        const screenshot = await page.screenshot({
          type: 'png',
          fullPage: options.fullPage ?? false,
        });

        this.logger.debug(`Screenshot generated (${screenshot.length} bytes)`);
        return screenshot as Buffer;
      } finally {
        await page.close();
      }
    } finally {
      await this.releaseBrowser(browser);
    }
  }

  /**
   * Health check - try to acquire and release a browser without throwing
   */
  async healthCheck(): Promise<boolean> {
    try {
      const browser = await this.acquireBrowser();
      await this.releaseBrowser(browser);
      return true;
    } catch (error) {
      this.logger.warn('PDF service health check failed', error.message);
      return false;
    }
  }
}
