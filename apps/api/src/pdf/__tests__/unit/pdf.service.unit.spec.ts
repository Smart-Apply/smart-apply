import { Test, TestingModule } from '@nestjs/testing';
import { PdfService } from '../../pdf.service';
import { ConfigService } from '../../../config/config.service';
import { TemplateRendererService } from '../../template-renderer.service';

// Mock Puppeteer module
jest.mock('puppeteer', () => ({
  launch: jest.fn().mockResolvedValue({
    newPage: jest.fn().mockResolvedValue({
      setContent: jest.fn(),
      addStyleTag: jest.fn(),
      setDefaultNavigationTimeout: jest.fn(),
      setDefaultTimeout: jest.fn(),
      pdf: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4\nMock PDF content')),
      close: jest.fn(),
    }),
    close: jest.fn(),
    isConnected: jest.fn().mockReturnValue(true),
    process: jest.fn().mockReturnValue({ pid: 12345 }),
  }),
}));

// Mock generic-pool
jest.mock('generic-pool', () => ({
  createPool: jest.fn((factory, opts) => {
    // Simple pool mock that just calls factory methods directly
    let browserInstance: any = null;

    return {
      acquire: jest.fn(async () => {
        if (!browserInstance) {
          browserInstance = await factory.create();
        }
        return browserInstance;
      }),
      release: jest.fn().mockResolvedValue(undefined),
      drain: jest.fn(async () => {
        if (browserInstance && factory.destroy) {
          await factory.destroy(browserInstance);
          browserInstance = null;
        }
      }),
      clear: jest.fn().mockResolvedValue(undefined),
      size: 1,
      available: 1,
      borrowed: 0,
      pending: 0,
    };
  }),
}));

describe('PdfService', () => {
  let service: PdfService;

  const mockConfigService = {
    puppeteerExecutablePath: undefined,
    puppeteerMaxBrowsers: 3,
    puppeteerMinBrowsers: 1,
    puppeteerIdleTimeoutMs: 30000,
    puppeteerEvictionIntervalMs: 10000,
    isDevelopment: false, // Disable metrics logging in tests
    isProduction: false,
    isTest: true,
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
    
    // Initialize the service (triggers pool creation)
    await service.onModuleInit();
  }, 30000);

  afterAll(async () => {
    // Cleanup browser pool
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
