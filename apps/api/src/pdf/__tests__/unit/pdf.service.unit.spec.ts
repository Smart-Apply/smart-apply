import { Test, TestingModule } from '@nestjs/testing';
import { PdfService } from '../../pdf.service';
import { ConfigService } from '../../../config/config.service';
import { TemplateRendererService } from '../../template-renderer.service';

describe('PdfService', () => {
  let service: PdfService;

  const mockConfigService = {
    puppeteerExecutablePath: undefined,
    isDevelopment: true,
    isProduction: false,
    isTest: false,
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PdfService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: TemplateRendererService,
          useValue: {
            renderCoverLetter: jest.fn().mockResolvedValue('<html>Mock Cover Letter</html>'),
            renderResume: jest.fn().mockResolvedValue('<html>Mock Resume</html>'),
          },
        },
      ],
    }).compile();

    service = module.get<PdfService>(PdfService);
  }, 30000);

  afterAll(async () => {
    // Cleanup browser
    await service.onModuleDestroy();
  }, 10000);

  describe('generatePDF', () => {
    it('should generate PDF from simple HTML', async () => {
      const html = '<html><body><h1>Test Document</h1><p>Hello World</p></body></html>';
      const pdf = await service.generatePDF(html);

      expect(pdf).toBeInstanceOf(Buffer);
      expect(pdf.length).toBeGreaterThan(0);
      // PDF magic bytes
      expect(pdf.toString('utf8', 0, 4)).toBe('%PDF');
    }, 30000);

    it('should apply cover letter template CSS', async () => {
      const html = `
        <html>
          <body>
            <div class="header">
              <h1>John Doe</h1>
              <div class="contact">john@example.com | +1 234 567 890</div>
            </div>
            <div class="body-text">
              <p>Dear Hiring Manager,</p>
              <p>I am writing to express my interest...</p>
            </div>
          </body>
        </html>
      `;

      const pdf = await service.generatePDF(html, { template: 'cover-letter' });

      expect(pdf).toBeInstanceOf(Buffer);
      expect(pdf.length).toBeGreaterThan(0);
      expect(pdf.toString('utf8', 0, 4)).toBe('%PDF');
    }, 30000);

    it('should apply resume template CSS', async () => {
      const html = `
        <html>
          <body>
            <div class="header">
              <h1>Jane Developer</h1>
            </div>
            <div class="section">
              <div class="section-title">Skills</div>
              <p>TypeScript, Python, React</p>
            </div>
          </body>
        </html>
      `;

      const pdf = await service.generatePDF(html, { template: 'resume' });

      expect(pdf).toBeInstanceOf(Buffer);
      expect(pdf.length).toBeGreaterThan(0);
      expect(pdf.toString('utf8', 0, 4)).toBe('%PDF');
    }, 30000);

    it('should handle invalid HTML gracefully', async () => {
      const invalidHtml = '<html><body><h1>Unclosed tag';

      // Should still generate PDF (Puppeteer auto-closes tags)
      const pdf = await service.generatePDF(invalidHtml);
      expect(pdf).toBeInstanceOf(Buffer);
      expect(pdf.toString('utf8', 0, 4)).toBe('%PDF');
    }, 30000);

    it('should support custom margins', async () => {
      const html = '<html><body><h1>Test</h1></body></html>';
      const options = {
        margin: {
          top: '10mm',
          right: '10mm',
          bottom: '10mm',
          left: '10mm',
        },
      };

      const pdf = await service.generatePDF(html, options);
      expect(pdf).toBeInstanceOf(Buffer);
      expect(pdf.toString('utf8', 0, 4)).toBe('%PDF');
    }, 30000);

    it('should support Letter format', async () => {
      const html = '<html><body><h1>Test</h1></body></html>';
      const options = {
        format: 'Letter' as const,
      };

      const pdf = await service.generatePDF(html, options);
      expect(pdf).toBeInstanceOf(Buffer);
      expect(pdf.toString('utf8', 0, 4)).toBe('%PDF');
    }, 30000);

    it('should default to A4 format', async () => {
      const html = '<html><body><h1>Test</h1></body></html>';

      const pdf = await service.generatePDF(html);
      expect(pdf).toBeInstanceOf(Buffer);
      expect(pdf.toString('utf8', 0, 4)).toBe('%PDF');
    }, 30000);
  });
});
