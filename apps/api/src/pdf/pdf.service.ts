import { Injectable, Logger } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import { ConfigService } from '../config/config.service';

export interface PdfGenerationOptions {
  template?: 'cover-letter' | 'resume';
  margin?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
  format?: 'A4' | 'Letter';
}

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);
  private browser: puppeteer.Browser;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    // Initialize browser on module startup
    this.browser = await puppeteer.launch({
      headless: true,
      executablePath: this.configService.puppeteerExecutablePath || undefined,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    this.logger.log('Puppeteer browser initialized');
  }

  async onModuleDestroy() {
    if (this.browser) {
      await this.browser.close();
      this.logger.log('Puppeteer browser closed');
    }
  }

  async generatePDF(
    html: string,
    options: PdfGenerationOptions = {},
  ): Promise<Buffer> {
    const page = await this.browser.newPage();

    try {
      // Set HTML content
      await page.setContent(html, {
        waitUntil: 'networkidle0',
      });

      // Add CSS based on template
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

  private getTemplateCSS(template: 'cover-letter' | 'resume'): string {
    // Base styles + template-specific styles
    const baseCSS = this.getBaseCSS();
    const templateCSS = template === 'cover-letter' 
      ? this.getCoverLetterCSS() 
      : this.getResumeCSS();
    
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
}
