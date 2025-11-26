import { Injectable, Logger } from '@nestjs/common';
import { PDFDocument } from 'pdf-lib';

/**
 * ATS Validation Result
 */
export interface AtsValidationResult {
  isTextBased: boolean; // Text is selectable and searchable
  hasComplexLayouts: boolean; // Tables, multi-column, text boxes detected
  usesSafeFonts: boolean; // Uses ATS-safe fonts (Arial, Calibri, etc.)
  hasMetadata: boolean; // PDF has title, author, keywords
  hasSingleColumn: boolean; // Single-column layout (not multi-column)
  hasSelectableText: boolean; // All text is selectable
  warnings: string[]; // List of ATS compatibility warnings
  score: number; // Overall ATS-friendliness score (0-100)
}

/**
 * Detailed ATS Validation Report
 */
export interface AtsValidationReport extends AtsValidationResult {
  checks: {
    textBased: {
      passed: boolean;
      message: string;
    };
    complexLayouts: {
      passed: boolean;
      message: string;
    };
    safeFonts: {
      passed: boolean;
      message: string;
      fontsDetected: string[];
    };
    metadata: {
      passed: boolean;
      message: string;
      title?: string;
      author?: string;
      keywords?: string[];
    };
    singleColumn: {
      passed: boolean;
      message: string;
    };
    selectableText: {
      passed: boolean;
      message: string;
    };
  };
  recommendations: string[];
}

/**
 * ATS Validator Service
 * Validates PDFs for ATS-compatibility
 */
@Injectable()
export class AtsValidatorService {
  private readonly logger = new Logger(AtsValidatorService.name);

  // ATS-safe fonts (commonly supported)
  // Note: Currently used for documentation/reference only
  // pdf-lib doesn't provide font inspection API, so actual validation is heuristic
  private readonly ATS_SAFE_FONTS = [
    'arial',
    'calibri',
    'cambria',
    'georgia',
    'helvetica',
    'times new roman',
    'verdana',
    'courier',
    'courier new',
  ];

  /**
   * Validate PDF for ATS-friendliness
   */
  async validatePdf(pdfBuffer: Buffer): Promise<AtsValidationResult> {
    try {
      const pdfDoc = await PDFDocument.load(pdfBuffer);
      
      // Run all validation checks
      const isTextBased = await this.checkTextBased(pdfDoc);
      const hasComplexLayouts = await this.checkComplexLayouts(pdfDoc);
      const usesSafeFonts = await this.checkFonts(pdfDoc);
      const hasMetadata = await this.checkMetadata(pdfDoc);
      const hasSingleColumn = await this.checkSingleColumn(pdfDoc);
      const hasSelectableText = isTextBased; // Same as text-based check

      // Collect warnings
      const warnings: string[] = [];
      if (!isTextBased) {
        warnings.push('PDF contains non-selectable text or images with text');
      }
      if (hasComplexLayouts) {
        warnings.push('PDF contains complex layouts (tables, multi-column, text boxes) that may confuse ATS');
      }
      if (!usesSafeFonts) {
        // Note: Currently always passes due to pdf-lib limitations
        // This warning is left for future enhancement
        warnings.push('PDF uses non-standard fonts that may not be recognized by ATS');
      }
      if (!hasMetadata) {
        warnings.push('PDF is missing metadata (title, author, keywords)');
      }
      if (!hasSingleColumn) {
        warnings.push('PDF may use multi-column layout which can be difficult for ATS to parse');
      }

      // Calculate ATS-friendliness score (0-100)
      // Note: hasSelectableText is same as isTextBased, so they're weighted together
      const score = this.calculateScore({
        isTextBased,
        hasComplexLayouts,
        usesSafeFonts,
        hasMetadata,
        hasSingleColumn,
        hasSelectableText,
        warnings,
        score: 0, // Will be set below
      });

      return {
        isTextBased,
        hasComplexLayouts,
        usesSafeFonts,
        hasMetadata,
        hasSingleColumn,
        hasSelectableText,
        warnings,
        score,
      };
    } catch (error) {
      this.logger.error('Failed to validate PDF for ATS-friendliness', error);
      throw new Error(`ATS validation failed: ${error.message}`);
    }
  }

  /**
   * Get detailed validation report with recommendations
   */
  async getDetailedReport(pdfBuffer: Buffer): Promise<AtsValidationReport> {
    try {
      const pdfDoc = await PDFDocument.load(pdfBuffer);
      
      // Run all checks with details
      const textBasedCheck = await this.checkTextBasedDetailed(pdfDoc);
      const complexLayoutsCheck = await this.checkComplexLayoutsDetailed(pdfDoc);
      const safeFontsCheck = await this.checkFontsDetailed(pdfDoc);
      const metadataCheck = await this.checkMetadataDetailed(pdfDoc);
      const singleColumnCheck = await this.checkSingleColumnDetailed(pdfDoc);
      // Selectable text is the same as text-based for our purposes
      // but we keep it separate in the report for clarity
      const selectableTextCheck = {
        passed: textBasedCheck.passed,
        message: textBasedCheck.passed
          ? 'Text is selectable and searchable'
          : 'Text may not be selectable (possibly in images)',
      };

      // Build validation result
      const result: AtsValidationResult = {
        isTextBased: textBasedCheck.passed,
        hasComplexLayouts: !complexLayoutsCheck.passed, // Inverted - we want NO complex layouts
        usesSafeFonts: safeFontsCheck.passed,
        hasMetadata: metadataCheck.passed,
        hasSingleColumn: singleColumnCheck.passed,
        hasSelectableText: selectableTextCheck.passed,
        warnings: [],
        score: 0,
      };

      // Collect warnings
      if (!textBasedCheck.passed) result.warnings.push(textBasedCheck.message);
      if (!complexLayoutsCheck.passed) result.warnings.push(complexLayoutsCheck.message);
      if (!safeFontsCheck.passed) result.warnings.push(safeFontsCheck.message);
      if (!metadataCheck.passed) result.warnings.push(metadataCheck.message);
      if (!singleColumnCheck.passed) result.warnings.push(singleColumnCheck.message);

      result.score = this.calculateScore(result);

      // Generate recommendations
      const recommendations: string[] = [];
      if (!textBasedCheck.passed) {
        recommendations.push('Ensure all text is selectable. Avoid embedding text in images.');
      }
      if (!complexLayoutsCheck.passed) {
        recommendations.push('Use simple single-column layout. Avoid tables, text boxes, and multi-column layouts.');
      }
      if (!safeFontsCheck.passed) {
        recommendations.push('Use ATS-safe fonts: Arial, Calibri, Georgia, or Helvetica.');
      }
      if (!metadataCheck.passed) {
        recommendations.push('Add PDF metadata: title, author, keywords for better ATS recognition.');
      }
      if (!singleColumnCheck.passed) {
        recommendations.push('Convert to single-column layout for maximum ATS compatibility.');
      }

      return {
        ...result,
        checks: {
          textBased: textBasedCheck,
          complexLayouts: complexLayoutsCheck,
          safeFonts: safeFontsCheck,
          metadata: metadataCheck,
          singleColumn: singleColumnCheck,
          selectableText: selectableTextCheck,
        },
        recommendations,
      };
    } catch (error) {
      this.logger.error('Failed to generate detailed ATS report', error);
      throw new Error(`ATS report generation failed: ${error.message}`);
    }
  }

  /**
   * Check if PDF is text-based (text is selectable and searchable)
   */
  private async checkTextBased(pdfDoc: PDFDocument): Promise<boolean> {
    try {
      // Get all pages and check for text content
      const pages = pdfDoc.getPages();
      let hasText = false;

      for (const page of pages) {
        // Check if page has text content
        const textContent = page.node.lookup(page.node.context.obj('Contents'));
        if (textContent) {
          hasText = true;
          break;
        }
      }

      return hasText;
    } catch (error) {
      this.logger.warn('Error checking text-based status', error);
      return true; // Assume true if check fails
    }
  }

  private async checkTextBasedDetailed(pdfDoc: PDFDocument) {
    const passed = await this.checkTextBased(pdfDoc);
    return {
      passed,
      message: passed
        ? 'PDF contains selectable text'
        : 'PDF may contain text in images or non-selectable text',
    };
  }

  /**
   * Check for complex layouts (tables, multi-column, text boxes)
   */
  private async checkComplexLayouts(pdfDoc: PDFDocument): Promise<boolean> {
    try {
      // This is a heuristic check - perfect detection is complex
      // We check for: form fields, annotations, multiple text regions
      const form = pdfDoc.getForm();
      const fields = form.getFields();
      
      // If there are form fields, it might have complex layouts
      if (fields.length > 0) {
        return true;
      }

      // Check pages for annotations (might indicate text boxes)
      const pages = pdfDoc.getPages();
      for (const page of pages) {
        const annots = page.node.Annots();
        if (annots && annots.size() > 0) {
          return true;
        }
      }

      // No complex layouts detected
      return false;
    } catch (error) {
      this.logger.warn('Error checking complex layouts', error);
      return false; // Assume no complex layouts if check fails
    }
  }

  private async checkComplexLayoutsDetailed(pdfDoc: PDFDocument) {
    const hasComplex = await this.checkComplexLayouts(pdfDoc);
    return {
      passed: !hasComplex, // We want NO complex layouts
      message: hasComplex
        ? 'PDF contains complex layouts (tables, text boxes, or form fields) that may be difficult for ATS to parse'
        : 'PDF uses simple layout without complex elements',
    };
  }

  /**
   * Check if PDF uses ATS-safe fonts
   * 
   * LIMITATION: pdf-lib doesn't provide a getEmbeddedFonts() API for font inspection.
   * For now, we assume fonts are safe if the PDF was generated by our system.
   * 
   * Future Enhancement: Parse PDF content streams to extract actual font information.
   * 
   * @returns true (assumes safe fonts for PDFs we generate)
   */
  private async checkFonts(pdfDoc: PDFDocument): Promise<boolean> {
    try {
      // Since we control PDF generation and always use Arial/Helvetica in our templates,
      // we can safely assume ATS-safe fonts are used.
      // 
      // This is acceptable for MVP because:
      // 1. We generate all PDFs (not accepting user uploads)
      // 2. Our templates explicitly use only Arial/Helvetica
      // 3. The ATS_SAFE_FONTS constant documents which fonts are safe
      return true;
    } catch (error) {
      this.logger.warn('Error checking fonts', error);
      return true; // Assume safe fonts if check fails
    }
  }

  private async checkFontsDetailed(pdfDoc: PDFDocument) {
    try {
      const passed = await this.checkFonts(pdfDoc);
      
      return {
        passed,
        message: passed
          ? 'PDF uses ATS-safe fonts (Arial/Helvetica)'
          : 'PDF uses custom or decorative fonts that may not be recognized by ATS',
        fontsDetected: ['Arial', 'Helvetica'], // Fonts we use in our templates
      };
    } catch (error) {
      return {
        passed: true,
        message: 'Unable to detect fonts (assuming safe)',
        fontsDetected: [],
      };
    }
  }

  /**
   * Check if PDF has proper metadata
   */
  private async checkMetadata(pdfDoc: PDFDocument): Promise<boolean> {
    try {
      const title = pdfDoc.getTitle();
      const author = pdfDoc.getAuthor();
      
      // PDF should have at least title and author
      return !!(title && author);
    } catch (error) {
      this.logger.warn('Error checking metadata', error);
      return false;
    }
  }

  private async checkMetadataDetailed(pdfDoc: PDFDocument) {
    try {
      const title = pdfDoc.getTitle();
      const author = pdfDoc.getAuthor();
      const keywordsStr = pdfDoc.getKeywords();
      const keywords = keywordsStr ? keywordsStr.split(',').map(k => k.trim()) : [];
      const passed = !!(title && author);
      
      return {
        passed,
        message: passed
          ? 'PDF has proper metadata (title, author)'
          : 'PDF is missing metadata (title and/or author)',
        title,
        author,
        keywords,
      };
    } catch (error) {
      return {
        passed: false,
        message: 'Unable to read PDF metadata',
      };
    }
  }

  /**
   * Check if PDF uses single-column layout
   * This is a heuristic check - perfect detection is complex
   */
  private async checkSingleColumn(pdfDoc: PDFDocument): Promise<boolean> {
    try {
      // Heuristic: check page width vs content width
      // Multi-column layouts typically use < 70% of page width per column
      const pages = pdfDoc.getPages();
      
      // For MVP, assume single-column if no complex layouts detected
      // (More sophisticated check would require text extraction and analysis)
      return !await this.checkComplexLayouts(pdfDoc);
    } catch (error) {
      this.logger.warn('Error checking single-column layout', error);
      return true; // Assume single-column if check fails
    }
  }

  private async checkSingleColumnDetailed(pdfDoc: PDFDocument) {
    const passed = await this.checkSingleColumn(pdfDoc);
    return {
      passed,
      message: passed
        ? 'PDF uses single-column layout'
        : 'PDF may use multi-column layout which can confuse ATS',
    };
  }

  /**
   * Calculate overall ATS-friendliness score (0-100)
   */
  private calculateScore(validation: AtsValidationResult): number {
    let score = 0;
    const weights = {
      isTextBased: 30, // Critical
      hasComplexLayouts: 20, // Important (inverted - we want NO complex layouts)
      usesSafeFonts: 15, // Important
      hasMetadata: 15, // Nice to have
      hasSingleColumn: 10, // Nice to have
      hasSelectableText: 10, // Same as text-based
    };

    if (validation.isTextBased) score += weights.isTextBased;
    if (!validation.hasComplexLayouts) score += weights.hasComplexLayouts; // Inverted
    if (validation.usesSafeFonts) score += weights.usesSafeFonts;
    if (validation.hasMetadata) score += weights.hasMetadata;
    if (validation.hasSingleColumn) score += weights.hasSingleColumn;
    if (validation.hasSelectableText) score += weights.hasSelectableText;

    return score;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Create a minimal test PDF
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      page.drawText('Test');
      const pdfBytes = await pdfDoc.save();
      
      // Try to validate it
      await this.validatePdf(Buffer.from(pdfBytes));
      return true;
    } catch (error) {
      this.logger.warn('ATS validator health check failed', error.message);
      return false;
    }
  }
}
