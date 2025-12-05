import { Test, TestingModule } from '@nestjs/testing';
import { AtsValidatorService } from '../../ats-validator.service';
import { PDFDocument, StandardFonts } from 'pdf-lib';

describe('AtsValidatorService', () => {
  let service: AtsValidatorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AtsValidatorService],
    }).compile();

    service = module.get<AtsValidatorService>(AtsValidatorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validatePdf', () => {
    it('should validate a simple text-based PDF as ATS-friendly', async () => {
      // Create a simple PDF with text
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

      page.drawText('John Doe', {
        x: 50,
        y: 700,
        size: 20,
        font: helveticaFont,
      });

      page.drawText('Software Engineer', {
        x: 50,
        y: 670,
        size: 14,
        font: helveticaFont,
      });

      // Set metadata
      pdfDoc.setTitle('Resume - John Doe');
      pdfDoc.setAuthor('John Doe');
      pdfDoc.setKeywords(['JavaScript', 'React', 'Node.js']);

      const pdfBytes = await pdfDoc.save();
      const pdfBuffer = Buffer.from(pdfBytes);

      const result = await service.validatePdf(pdfBuffer);

      expect(result).toBeDefined();
      expect(result.isTextBased).toBe(true);
      expect(result.hasMetadata).toBe(true);
      expect(result.usesSafeFonts).toBe(true);
      expect(result.score).toBeGreaterThan(70);
    });

    it('should detect missing metadata', async () => {
      // Create PDF without metadata
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

      page.drawText('Test Resume', {
        x: 50,
        y: 700,
        size: 14,
        font: helveticaFont,
      });

      // No metadata set
      const pdfBytes = await pdfDoc.save();
      const pdfBuffer = Buffer.from(pdfBytes);

      const result = await service.validatePdf(pdfBuffer);

      expect(result.hasMetadata).toBe(false);
      expect(result.warnings).toContain('PDF is missing metadata (title, author, keywords)');
    });

    it('should detect complex layouts with form fields', async () => {
      // Create PDF with form fields (complex layout indicator)
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();

      // Add a text field (indicates complex layout)
      const textField = form.createTextField('test.field');
      textField.addToPage(page, { x: 50, y: 700, width: 200, height: 30 });

      const pdfBytes = await pdfDoc.save();
      const pdfBuffer = Buffer.from(pdfBytes);

      const result = await service.validatePdf(pdfBuffer);

      expect(result.hasComplexLayouts).toBe(true);
      expect(result.warnings).toContain(
        'PDF contains complex layouts (tables, multi-column, text boxes) that may confuse ATS',
      );
    });

    it('should calculate ATS score correctly', async () => {
      // Create a fully ATS-optimized PDF
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

      page.drawText('John Doe - Software Engineer', {
        x: 50,
        y: 700,
        size: 14,
        font: helveticaFont,
      });

      pdfDoc.setTitle('Resume - John Doe');
      pdfDoc.setAuthor('John Doe');
      pdfDoc.setSubject('Software Engineer Application');
      pdfDoc.setKeywords(['JavaScript', 'TypeScript', 'React']);

      const pdfBytes = await pdfDoc.save();
      const pdfBuffer = Buffer.from(pdfBytes);

      const result = await service.validatePdf(pdfBuffer);

      // Perfect ATS score: text-based (30) + no complex layouts (20) + safe fonts (15) + metadata (15) + single column (10) + selectable (10) = 100
      expect(result.score).toBe(100);
      expect(result.warnings).toHaveLength(0);
    });

    it('should handle safe fonts correctly', async () => {
      // Test with Helvetica (safe font)
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

      page.drawText('Resume Text', {
        x: 50,
        y: 700,
        size: 12,
        font: helveticaFont,
      });

      pdfDoc.setTitle('Resume');
      pdfDoc.setAuthor('Test User');

      const pdfBytes = await pdfDoc.save();
      const pdfBuffer = Buffer.from(pdfBytes);

      const result = await service.validatePdf(pdfBuffer);

      expect(result.usesSafeFonts).toBe(true);
    });
  });

  describe('getDetailedReport', () => {
    it('should provide detailed validation report', async () => {
      // Create a PDF with some ATS issues
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

      page.drawText('Resume without metadata', {
        x: 50,
        y: 700,
        size: 12,
        font: helveticaFont,
      });

      // No metadata set
      const pdfBytes = await pdfDoc.save();
      const pdfBuffer = Buffer.from(pdfBytes);

      const report = await service.getDetailedReport(pdfBuffer);

      expect(report).toBeDefined();
      expect(report.checks).toBeDefined();
      expect(report.checks.textBased).toBeDefined();
      expect(report.checks.metadata).toBeDefined();
      expect(report.checks.safeFonts).toBeDefined();
      expect(report.recommendations).toBeDefined();
      expect(report.recommendations.length).toBeGreaterThan(0);
    });

    it('should provide recommendations for ATS improvements', async () => {
      // Create a non-ATS-friendly PDF
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();

      // Add form field (complex layout)
      const textField = form.createTextField('test.field');
      textField.addToPage(page, { x: 50, y: 700, width: 200, height: 30 });

      // No metadata
      const pdfBytes = await pdfDoc.save();
      const pdfBuffer = Buffer.from(pdfBytes);

      const report = await service.getDetailedReport(pdfBuffer);

      expect(report.recommendations).toContain(
        'Use simple single-column layout. Avoid tables, text boxes, and multi-column layouts.',
      );
      expect(report.recommendations).toContain(
        'Add PDF metadata: title, author, keywords for better ATS recognition.',
      );
    });

    it('should include font detection in detailed report', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const timesRoman = await pdfDoc.embedFont(StandardFonts.TimesRoman);

      page.drawText('Test Text', {
        x: 50,
        y: 700,
        size: 12,
        font: timesRoman,
      });

      pdfDoc.setTitle('Test');
      pdfDoc.setAuthor('Test');

      const pdfBytes = await pdfDoc.save();
      const pdfBuffer = Buffer.from(pdfBytes);

      const report = await service.getDetailedReport(pdfBuffer);

      expect(report.checks.safeFonts).toBeDefined();
      expect(report.checks.safeFonts.fontsDetected).toBeDefined();
    });

    it('should include metadata details in report', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

      page.drawText('Test', {
        x: 50,
        y: 700,
        size: 12,
        font: helvetica,
      });

      pdfDoc.setTitle('Resume - Jane Doe');
      pdfDoc.setAuthor('Jane Doe');
      // pdf-lib accepts array but stores as comma-separated string
      pdfDoc.setKeywords(['Python', 'Django', 'PostgreSQL']);

      const pdfBytes = await pdfDoc.save();
      const pdfBuffer = Buffer.from(pdfBytes);

      const report = await service.getDetailedReport(pdfBuffer);

      expect(report.checks.metadata.passed).toBe(true);
      expect(report.checks.metadata.title).toBe('Resume - Jane Doe');
      expect(report.checks.metadata.author).toBe('Jane Doe');
      // Keywords are split from comma-separated string
      expect(report.checks.metadata.keywords?.length).toBeGreaterThan(0);
      expect(report.checks.metadata.keywords?.some((k) => k.includes('Python'))).toBe(true);
    });
  });

  describe('healthCheck', () => {
    it('should pass health check', async () => {
      const isHealthy = await service.healthCheck();
      expect(isHealthy).toBe(true);
    });
  });

  describe('score calculation', () => {
    it('should give high score to fully optimized PDF', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

      page.drawText('Perfect ATS Resume', { x: 50, y: 700, size: 12, font });

      pdfDoc.setTitle('Resume');
      pdfDoc.setAuthor('Test User');
      pdfDoc.setKeywords(['Skill1', 'Skill2']);

      const pdfBytes = await pdfDoc.save();
      const result = await service.validatePdf(Buffer.from(pdfBytes));

      expect(result.score).toBeGreaterThanOrEqual(90);
    });

    it('should give low score to non-optimized PDF', async () => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const form = pdfDoc.getForm();

      // Complex layout with form
      const field = form.createTextField('field');
      field.addToPage(page, { x: 50, y: 700, width: 100, height: 20 });

      // No metadata
      const pdfBytes = await pdfDoc.save();
      const result = await service.validatePdf(Buffer.from(pdfBytes));

      expect(result.score).toBeLessThan(90);
    });
  });
});
