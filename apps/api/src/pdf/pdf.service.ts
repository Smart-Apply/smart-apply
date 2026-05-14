import { Injectable, Logger } from '@nestjs/common';
import { ReactPdfRendererService } from '../pdf-v2/react-pdf-renderer.service';
import type {
  CoverLetterTemplateData,
  ResumeTemplateData,
} from '../pdf-v2/template-data';

export interface PdfMetadata {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string[];
  creator?: string;
}

export interface PdfGenerationOptions {
  /**
   * ATS-optimized rendering. Templates suppress decorative chrome and
   * lay out text so resume parsers can extract it cleanly.
   */
  atsOptimized?: boolean;
  /**
   * Optional metadata. Currently informational only — react-pdf sets
   * basic title/author internally and we no longer post-process with
   * pdf-lib. Kept on the type for API stability.
   */
  metadata?: PdfMetadata;
}

/**
 * Thin façade over `ReactPdfRendererService`. Exists so external callers
 * (`application.processor.ts`, tests, future consumers) keep using the
 * same `PdfService` API surface that pre-dates the puppeteer removal.
 *
 * Throws when the requested template has no react-pdf implementation
 * registered in `pdf-v2/template-registry.ts`. Previously this would
 * fall back to the puppeteer + Handlebars path, but that path is gone.
 */
@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

  constructor(private readonly reactPdfRenderer: ReactPdfRendererService) {}

  async generateCoverLetterPDF(
    data: CoverLetterTemplateData,
    templateId?: string,
    options: PdfGenerationOptions = {},
  ): Promise<Buffer> {
    const buf = await this.reactPdfRenderer.renderCoverLetter(data, templateId, {
      atsOptimized: options.atsOptimized,
    });
    if (!buf) {
      throw new Error(
        `Cover letter template "${templateId ?? '<default>'}" has no react-pdf implementation registered.`,
      );
    }
    this.logger.log(`Cover letter rendered via react-pdf (${buf.length} bytes)`);
    return buf;
  }

  async generateResumePDF(
    data: ResumeTemplateData,
    templateId?: string,
    options: PdfGenerationOptions = {},
  ): Promise<Buffer> {
    const buf = await this.reactPdfRenderer.renderResume(data, templateId, {
      atsOptimized: options.atsOptimized,
    });
    if (!buf) {
      throw new Error(
        `Resume template "${templateId ?? '<default>'}" has no react-pdf implementation registered.`,
      );
    }
    this.logger.log(`Resume rendered via react-pdf (${buf.length} bytes)`);
    return buf;
  }
}
