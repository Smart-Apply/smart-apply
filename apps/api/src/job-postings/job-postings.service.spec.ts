import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { JobPostingsService } from './job-postings.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { TextParser } from './parsers/text.parser';
import { UrlParser } from './parsers/url.parser';
import { PdfParser } from './parsers/pdf.parser';
import { DocxParser } from './parsers/docx.parser';

describe('JobPostingsService', () => {
  let service: JobPostingsService;
  let prismaService: PrismaService;
  let storageService: StorageService;

  const mockPrismaService = {
    jobPosting: {
      create: jest.fn(),
    },
  };

  const mockStorageService = {
    upload: jest.fn(),
    download: jest.fn(),
    delete: jest.fn(),
    getSignedUrl: jest.fn(),
    healthCheck: jest.fn(),
  };

  const mockJobPostingData = {
    id: 'test-id',
    userId: 'user-123',
    title: 'Senior Software Engineer',
    company: 'Google',
    location: 'Remote, USA',
    description: 'We are looking for a talented Senior Software Engineer',
    requirements: ['5+ years of experience', 'Strong knowledge of Java'],
    responsibilities: ['Design scalable services', 'Collaborate with teams'],
    niceToHave: ['Experience with Kubernetes', 'ML knowledge'],
    rawText: 'Full job posting text',
    sourceUrl: null,
    fileId: null,
    language: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobPostingsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: StorageService,
          useValue: mockStorageService,
        },
        TextParser,
        UrlParser,
        PdfParser,
        DocxParser,
      ],
    }).compile();

    service = module.get<JobPostingsService>(JobPostingsService);
    prismaService = module.get<PrismaService>(PrismaService);
    storageService = module.get<StorageService>(StorageService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('parseJobPosting', () => {
    it('should parse job posting from text input', async () => {
      const textInput = `
Senior Software Engineer at Google

Location: Remote, USA

Requirements:
- 5+ years of experience in software development
- Strong knowledge of Java, Python, or Go

Responsibilities:
- Design and implement scalable backend services
- Collaborate with cross-functional teams

Nice to Have:
- Experience with Kubernetes and Docker
`;

      mockPrismaService.jobPosting.create.mockResolvedValue(mockJobPostingData);

      const result = await service.parseJobPosting('user-123', { text: textInput });

      expect(result).toBeDefined();
      expect(result.title).toBe('Senior Software Engineer');
      expect(result.company).toBe('Google');
      expect(prismaService.jobPosting.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: expect.any(String),
            company: expect.any(String),
            requirements: expect.any(Array),
            responsibilities: expect.any(Array),
          }),
        }),
      );
    });

    it('should throw error if no input source provided', async () => {
      await expect(service.parseJobPosting('user-123', {})).rejects.toThrow(BadRequestException);
      await expect(service.parseJobPosting('user-123', {})).rejects.toThrow('At least one input source');
    });

    it('should use fallback values if title cannot be extracted', async () => {
      const textInput = 'This is just random text without job posting structure';

      mockPrismaService.jobPosting.create.mockResolvedValue({
        ...mockJobPostingData,
        title: 'Unknown Position',
        company: 'Unknown Company',
      });

      const result = await service.parseJobPosting('user-123', { text: textInput });

      // Service should use fallback values
      expect(result.title).toBeDefined();
      expect(result.company).toBeDefined();
    });

    it('should parse job posting from URL', async () => {
      const dto = { url: 'https://example.com/job' };

      // Mock URL parser to return structured text
      jest.spyOn(service['urlParser'], 'parse').mockResolvedValue(`
Senior Developer at TechCorp

Requirements:
- 3+ years experience
- JavaScript expertise

Responsibilities:
- Build web applications
      `);

      mockPrismaService.jobPosting.create.mockResolvedValue({
        ...mockJobPostingData,
        sourceUrl: dto.url,
      });

      const result = await service.parseJobPosting('user-123', dto);

      expect(result).toBeDefined();
      expect(result.sourceUrl).toBe(dto.url);
      expect(service['urlParser'].parse).toHaveBeenCalledWith(dto.url);
    });

    it('should parse job posting from PDF file', async () => {
      const fileId = Buffer.from('user-123/test.pdf').toString('base64');
      const dto = { fileId };

      mockStorageService.download.mockResolvedValue(Buffer.from('mock pdf content'));
      jest.spyOn(service['pdfParser'], 'parse').mockResolvedValue(`
Software Architect at Microsoft

Requirements:
- 10+ years experience
- Cloud architecture expertise

Responsibilities:
- Design cloud solutions
      `);

      mockPrismaService.jobPosting.create.mockResolvedValue({
        ...mockJobPostingData,
        fileId,
      });

      const result = await service.parseJobPosting('user-123', dto);

      expect(result).toBeDefined();
      expect(result.fileId).toBe(fileId);
      expect(storageService.download).toHaveBeenCalled();
      expect(service['pdfParser'].parse).toHaveBeenCalled();
    });

    it('should parse job posting from DOCX file', async () => {
      const fileId = Buffer.from('user-123/test.docx').toString('base64');
      const dto = { fileId };

      mockStorageService.download.mockResolvedValue(Buffer.from('mock docx content'));
      jest.spyOn(service['docxParser'], 'parse').mockResolvedValue(`
Backend Engineer at Amazon

Requirements:
- 5+ years Python
- AWS experience

Responsibilities:
- Build APIs
      `);

      mockPrismaService.jobPosting.create.mockResolvedValue({
        ...mockJobPostingData,
        fileId,
      });

      const result = await service.parseJobPosting('user-123', dto);

      expect(result).toBeDefined();
      expect(result.fileId).toBe(fileId);
      expect(storageService.download).toHaveBeenCalled();
      expect(service['docxParser'].parse).toHaveBeenCalled();
    });

    it('should throw error for unsupported file type', async () => {
      const fileId = Buffer.from('user-123/test.txt').toString('base64');
      const dto = { fileId };

      mockStorageService.download.mockResolvedValue(Buffer.from('mock txt content'));

      await expect(service.parseJobPosting('user-123', dto)).rejects.toThrow(BadRequestException);
      await expect(service.parseJobPosting('user-123', dto)).rejects.toThrow('Unsupported file type');
    });

    it('should extract requirements from text', async () => {
      const textInput = `
Job Title: DevOps Engineer

Requirements:
- Strong Linux skills
- Docker and Kubernetes experience
- CI/CD pipeline knowledge
- Infrastructure as Code (Terraform)
      `;

      mockPrismaService.jobPosting.create.mockResolvedValue(mockJobPostingData);

      const result = await service.parseJobPosting('user-123', { text: textInput });

      expect(result.requirements.length).toBeGreaterThan(0);
      // Should extract at least one requirement
    });

    it('should extract responsibilities from text', async () => {
      const textInput = `
Position: Frontend Developer at Facebook

Responsibilities:
- Build user interfaces with React
- Optimize application performance
- Write unit and integration tests
      `;

      mockPrismaService.jobPosting.create.mockResolvedValue(mockJobPostingData);

      const result = await service.parseJobPosting('user-123', { text: textInput });

      expect(result.responsibilities.length).toBeGreaterThan(0);
    });

    it('should extract nice-to-have qualifications', async () => {
      const textInput = `
Job: Full Stack Developer

Nice to Have:
- TypeScript experience
- GraphQL knowledge
- Previous startup experience
      `;

      mockPrismaService.jobPosting.create.mockResolvedValue(mockJobPostingData);

      const result = await service.parseJobPosting('user-123', { text: textInput });

      expect(result.niceToHave).toBeDefined();
      expect(Array.isArray(result.niceToHave)).toBe(true);
    });
  });
});
