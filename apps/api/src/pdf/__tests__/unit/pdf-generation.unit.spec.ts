import { Test, TestingModule } from '@nestjs/testing';
import { PdfService } from '../../pdf.service';
import {
  TemplateRendererService,
  CoverLetterTemplateData,
} from '../../template-renderer.service';
import { ReactPdfRendererService } from '../../../pdf-v2/react-pdf-renderer.service';
import { ConfigService } from '@/config/config.service';
import { MockHelper } from '../../../../test/helpers/mock.helper';

describe('PdfService.generateCoverLetterPDF (Unit)', () => {
  let service: PdfService;
  let templateRenderer: TemplateRendererService;

  const fakePdfBytes = new Uint8Array([
    0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, // %PDF-1.4
  ]);

  const mockPage = {
    setDefaultNavigationTimeout: jest.fn(),
    setDefaultTimeout: jest.fn(),
    setContent: jest.fn().mockResolvedValue(undefined),
    evaluate: jest.fn().mockResolvedValue(undefined),
    addStyleTag: jest.fn().mockResolvedValue(undefined),
    pdf: jest.fn().mockResolvedValue(Buffer.from(fakePdfBytes)),
    close: jest.fn().mockResolvedValue(undefined),
  };

  const mockBrowser = {
    newPage: jest.fn().mockResolvedValue(mockPage),
    isConnected: jest.fn().mockReturnValue(true),
    process: jest.fn().mockReturnValue({ pid: 1234 }),
    close: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PdfService,
        { provide: ConfigService, useValue: MockHelper.createMockConfigService() },
        {
          provide: TemplateRendererService,
          useValue: {
            renderCoverLetter: jest
              .fn()
              .mockResolvedValue('<html><body>Cover Letter</body></html>'),
            renderResume: jest.fn().mockResolvedValue('<html><body>Resume</body></html>'),
          },
        },
        {
          provide: ReactPdfRendererService,
          useValue: {
            // Always say "no, fall back to puppeteer" so existing assertions
            // against the puppeteer pipeline keep working.
            supports: jest.fn().mockResolvedValue(false),
            renderResume: jest.fn().mockResolvedValue(undefined),
            renderCoverLetter: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<PdfService>(PdfService);
    templateRenderer = module.get<TemplateRendererService>(TemplateRendererService);

    // Stub the browser pool acquire/release so we never actually launch Chromium
    (service as unknown as { acquireBrowser: () => Promise<typeof mockBrowser> }).acquireBrowser =
      jest.fn().mockResolvedValue(mockBrowser);
    (service as unknown as { releaseBrowser: () => Promise<void> }).releaseBrowser = jest
      .fn()
      .mockResolvedValue(undefined);

    jest.clearAllMocks();
  });

  it('should generate a cover letter PDF buffer from template data', async () => {
    const data: CoverLetterTemplateData = {
      candidate: { firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com' },
      jobPosting: { title: 'Software Engineer', company: 'Acme' },
      content: { paragraphs: ['Hello world'] },
    } as unknown as CoverLetterTemplateData;

    const buffer = await service.generateCoverLetterPDF(data);

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
    // Starts with the %PDF magic bytes
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
    expect(templateRenderer.renderCoverLetter).toHaveBeenCalledWith(
      data,
      undefined,
      undefined,
    );
    expect(mockPage.setContent).toHaveBeenCalled();
    expect(mockPage.pdf).toHaveBeenCalled();
    expect(mockPage.close).toHaveBeenCalled();
  });

  it('should propagate errors from the template renderer', async () => {
    (templateRenderer.renderCoverLetter as jest.Mock).mockRejectedValueOnce(
      new Error('template missing'),
    );

    await expect(
      service.generateCoverLetterPDF({} as CoverLetterTemplateData),
    ).rejects.toThrow(/Cover letter PDF generation failed: template missing/);
  });
});
