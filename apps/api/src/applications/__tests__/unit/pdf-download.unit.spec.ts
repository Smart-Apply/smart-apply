import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import type { Mock } from 'vitest';
import { ApplicationsService } from '../../applications.service';
import { PrismaService } from '@/prisma/prisma.service';
import { JobsService } from '@/jobs/jobs.service';
import { StorageService } from '@/storage/storage.service';
import { LLMService } from '@/llm/llm.service';
import { TitleGeneratorService } from '../../title-generator.service';
import { KeywordsService } from '@/keywords/keywords.service';
import { TemplatesService } from '@/templates/templates.service';
import { SubscriptionService } from '@/subscription/subscription.service';
import { NotFoundWithCode } from '@/common/exceptions/coded-http.exception';
import { MockHelper } from '../../../../test/helpers/mock.helper';

describe('ApplicationsService.getFileStream — PDF download (Unit)', () => {
  let service: ApplicationsService;
  let prisma: PrismaService;
  let storageService: { getFile: Mock };

  const userId = 'user-id-123';
  const applicationId = 'app-id-789';
  const fakePdf = Buffer.from('%PDF-1.4 fake pdf content');

  beforeEach(async () => {
    const mockPrisma = MockHelper.createMockPrismaService();
    mockPrisma.application.findFirst = vi.fn();

    storageService = { getFile: vi.fn().mockResolvedValue(fakePdf) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApplicationsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JobsService, useValue: { enqueue: vi.fn() } },
        { provide: StorageService, useValue: storageService },
        { provide: LLMService, useValue: {} },
        { provide: TitleGeneratorService, useValue: {} },
        { provide: KeywordsService, useValue: {} },
        { provide: TemplatesService, useValue: {} },
        { provide: SubscriptionService, useValue: { incrementUsage: vi.fn() } },
      ],
    }).compile();

    service = module.get<ApplicationsService>(ApplicationsService);
    prisma = module.get<PrismaService>(PrismaService);

    vi.clearAllMocks();
  });

  it('should return the cover-letter PDF buffer for a READY application', async () => {
    prisma.application.findFirst = vi.fn().mockResolvedValue({
      id: applicationId,
      userId,
      status: 'READY',
      coverLetterFileKey: 'cover-letter-key.pdf',
      resumeFileKey: 'resume-key.pdf',
    });

    const result = await service.getFileStream(userId, applicationId, 'cover-letter');

    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.toString()).toBe(fakePdf.toString());
    expect(storageService.getFile).toHaveBeenCalledWith('cover-letter-key.pdf');
  });

  it('should return the resume PDF buffer for a READY application', async () => {
    prisma.application.findFirst = vi.fn().mockResolvedValue({
      id: applicationId,
      userId,
      status: 'READY',
      coverLetterFileKey: 'cover-letter-key.pdf',
      resumeFileKey: 'resume-key.pdf',
    });

    const result = await service.getFileStream(userId, applicationId, 'resume');

    expect(storageService.getFile).toHaveBeenCalledWith('resume-key.pdf');
    expect(Buffer.isBuffer(result)).toBe(true);
  });

  it('should throw NotFoundWithCode when application does not belong to the user', async () => {
    prisma.application.findFirst = vi.fn().mockResolvedValue(null);

    await expect(
      service.getFileStream(userId, applicationId, 'resume'),
    ).rejects.toThrow(NotFoundWithCode);
    expect(storageService.getFile).not.toHaveBeenCalled();
  });

  it('should throw BadRequestException when application is not READY', async () => {
    prisma.application.findFirst = vi.fn().mockResolvedValue({
      id: applicationId,
      userId,
      status: 'GENERATING',
      coverLetterFileKey: null,
      resumeFileKey: null,
    });

    await expect(
      service.getFileStream(userId, applicationId, 'cover-letter'),
    ).rejects.toThrow(BadRequestException);
    expect(storageService.getFile).not.toHaveBeenCalled();
  });
});
