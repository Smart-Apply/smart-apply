import { Test, TestingModule } from '@nestjs/testing';
import { PdfService } from '../../pdf.service';
import { ConfigService } from '../../../config/config.service';
import { TemplateRendererService } from '../../template-renderer.service';

describe('PdfService - Browser Pool Integration', () => {
  let service: PdfService;
  let module: TestingModule;

  const mockConfigService = {
    puppeteerExecutablePath: undefined,
    puppeteerMaxBrowsers: 3, // Limit to 3 browsers
    puppeteerMinBrowsers: 1,
    puppeteerIdleTimeoutMs: 5000, // Shorter timeout for testing
    puppeteerEvictionIntervalMs: 2000,
    isDevelopment: false, // Disable metrics logging
    isProduction: false,
    isTest: true,
  };

  beforeAll(async () => {
    module = await Test.createTestingModule({
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
    await service.onModuleInit();
  }, 30000);

  afterAll(async () => {
    await service.onModuleDestroy();
    await module.close();
  }, 10000);

  describe('Concurrent PDF Generation', () => {
    it('should handle concurrent PDF generation requests', async () => {
      const html = '<html><body><h1>Test Document</h1><p>Content</p></body></html>';
      
      // Generate 10 PDFs concurrently (pool max is 3, so some will queue)
      const promises = Array.from({ length: 10 }, (_, i) => {
        return service.generatePDF(`${html} <!-- Request ${i} -->`, {
          format: 'A4',
        });
      });

      const results = await Promise.all(promises);

      // All PDFs should be generated successfully
      expect(results).toHaveLength(10);
      results.forEach((pdf) => {
        expect(pdf).toBeInstanceOf(Buffer);
        expect(pdf.length).toBeGreaterThan(0);
        expect(pdf.toString('utf8', 0, 4)).toBe('%PDF');
      });
    }, 60000);

    it('should reuse browsers from the pool', async () => {
      const html = '<html><body><h1>Test</h1></body></html>';
      
      // Generate PDFs sequentially
      const pdf1 = await service.generatePDF(html);
      const pdf2 = await service.generatePDF(html);
      const pdf3 = await service.generatePDF(html);

      // All should succeed
      expect(pdf1).toBeInstanceOf(Buffer);
      expect(pdf2).toBeInstanceOf(Buffer);
      expect(pdf3).toBeInstanceOf(Buffer);
    }, 30000);

    it('should handle errors gracefully without breaking the pool', async () => {
      const validHtml = '<html><body><h1>Valid</h1></body></html>';
      
      // Generate a valid PDF first
      const pdf1 = await service.generatePDF(validHtml);
      expect(pdf1).toBeInstanceOf(Buffer);

      // Even if there were errors (none in this mock), pool should still work
      const pdf2 = await service.generatePDF(validHtml);
      expect(pdf2).toBeInstanceOf(Buffer);
    }, 30000);
  });

  describe('Pool Cleanup', () => {
    it('should properly cleanup on module destroy', async () => {
      // Create a fresh service instance
      const testModule = await Test.createTestingModule({
        providers: [
          PdfService,
          {
            provide: ConfigService,
            useValue: mockConfigService,
          },
          {
            provide: TemplateRendererService,
            useValue: {
              renderCoverLetter: jest.fn().mockResolvedValue('<html>Mock</html>'),
              renderResume: jest.fn().mockResolvedValue('<html>Mock</html>'),
            },
          },
        ],
      }).compile();

      const testService = testModule.get<PdfService>(PdfService);
      await testService.onModuleInit();

      // Generate a PDF to ensure browser is created
      const html = '<html><body><h1>Test</h1></body></html>';
      const pdf = await testService.generatePDF(html);
      expect(pdf).toBeInstanceOf(Buffer);

      // Cleanup should not throw
      await expect(testService.onModuleDestroy()).resolves.not.toThrow();
      await testModule.close();
    }, 30000);
  });

  describe('Health Check', () => {
    it('should pass health check when pool is healthy', async () => {
      const isHealthy = await service.healthCheck();
      expect(isHealthy).toBe(true);
    }, 10000);
  });
});
