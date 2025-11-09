import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ApplicationsService } from './applications.service';
import { PrismaService } from '../prisma/prisma.service';
import { JobsService } from '../jobs/jobs.service';
import { StorageService } from '../storage/storage.service';
import { JobType } from '../jobs/interfaces/queue.interface';
import { CreateApplicationDto } from './dto/create-application.dto';

describe('ApplicationsService', () => {
  let service: ApplicationsService;
  let prisma: PrismaService;
  let jobsService: JobsService;
  let storageService: StorageService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApplicationsService,
        {
          provide: PrismaService,
          useValue: {
            application: {
              create: jest.fn(),
              findFirst: jest.fn(),
              findMany: jest.fn(),
              update: jest.fn(),
            },
            jobPosting: {
              findUnique: jest.fn(),
            },
            profile: {
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: JobsService,
          useValue: {
            publishJob: jest.fn(),
          },
        },
        {
          provide: StorageService,
          useValue: {
            getSignedUrl: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ApplicationsService>(ApplicationsService);
    prisma = module.get<PrismaService>(PrismaService);
    jobsService = module.get<JobsService>(JobsService);
    storageService = module.get<StorageService>(StorageService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create application and queue job', async () => {
      const userId = 'user-123';
      const dto: CreateApplicationDto = {
        jobPostingId: 'job-123',
        notes: 'Test notes',
      };

      jest.spyOn(prisma.jobPosting, 'findUnique').mockResolvedValue({
        id: 'job-123',
        title: 'Test Job',
        company: 'Test Co',
        location: null,
        description: null,
        rawText: null,
        sourceUrl: null,
        fileId: null,
        requirements: [],
        language: 'en',
        responsibilities: [],
        niceToHave: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      jest.spyOn(prisma.profile, 'findUnique').mockResolvedValue({
        id: 'profile-123',
        userId,
        summary: null,
        phone: null,
        location: null,
        linkedinUrl: null,
        githubUrl: null,
        portfolioUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      jest.spyOn(prisma.application, 'create').mockResolvedValue({
        id: 'app-123',
        userId,
        jobPostingId: dto.jobPostingId,
        status: 'PENDING',
        notes: dto.notes,
        coverLetterText: null,
        resumeText: null,
        coverLetterFileKey: null,
        resumeFileKey: null,
        errorMessage: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        jobPosting: {
          id: 'job-123',
          title: 'Test Job',
          company: 'Test Co',
          location: null,
          description: null,
          rawText: null,
          sourceUrl: null,
          fileId: null,
          requirements: [],
          responsibilities: [],
          niceToHave: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      } as any);

      jest.spyOn(jobsService, 'publishJob').mockResolvedValue('job-id-123');

      const result = await service.create(userId, dto);

      expect(result.id).toBe('app-123');
      expect(result.status).toBe('PENDING');
      expect(jobsService.publishJob).toHaveBeenCalledWith(JobType.APPLICATION_GENERATE, {
        applicationId: 'app-123',
        userId,
        jobPostingId: dto.jobPostingId,
      });
    });

    it('should throw NotFoundException if job posting not found', async () => {
      jest.spyOn(prisma.jobPosting, 'findUnique').mockResolvedValue(null);

      await expect(service.create('user-123', { jobPostingId: 'invalid' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if profile not found', async () => {
      jest.spyOn(prisma.jobPosting, 'findUnique').mockResolvedValue({
        id: 'job-123',
        title: 'Test Job',
        company: 'Test Co',
      } as any);
      jest.spyOn(prisma.profile, 'findUnique').mockResolvedValue(null);

      await expect(service.create('user-123', { jobPostingId: 'job-123' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should mark application as FAILED if job queueing fails', async () => {
      const userId = 'user-123';
      const dto: CreateApplicationDto = {
        jobPostingId: 'job-123',
      };

      jest.spyOn(prisma.jobPosting, 'findUnique').mockResolvedValue({
        id: 'job-123',
        title: 'Test Job',
        company: 'Test Co',
      } as any);

      jest.spyOn(prisma.profile, 'findUnique').mockResolvedValue({
        id: 'profile-123',
        userId,
      } as any);

      const mockApplication = {
        id: 'app-123',
        userId,
        jobPostingId: dto.jobPostingId,
        status: 'PENDING',
        jobPosting: { id: 'job-123', title: 'Test Job', company: 'Test Co' },
      };

      jest.spyOn(prisma.application, 'create').mockResolvedValue(mockApplication as any);

      jest.spyOn(jobsService, 'publishJob').mockRejectedValue(new Error('Queue error'));

      jest.spyOn(prisma.application, 'update').mockResolvedValue({
        ...mockApplication,
        status: 'FAILED',
        errorMessage: 'Failed to queue application for processing',
      } as any);

      await expect(service.create(userId, dto)).rejects.toThrow(BadRequestException);

      expect(prisma.application.update).toHaveBeenCalledWith({
        where: { id: 'app-123' },
        data: {
          status: 'FAILED',
          errorMessage: 'Failed to queue application for processing',
        },
      });
    });
  });

  describe('findOne', () => {
    it('should return application by ID', async () => {
      const application = {
        id: 'app-123',
        userId: 'user-123',
        jobPostingId: 'job-123',
        status: 'PENDING',
        notes: null,
        coverLetterText: null,
        resumeText: null,
        coverLetterFileKey: null,
        resumeFileKey: null,
        errorMessage: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(prisma.application, 'findFirst').mockResolvedValue(application as any);

      const result = await service.findOne('user-123', 'app-123');

      expect(result.id).toBe('app-123');
      expect(prisma.application.findFirst).toHaveBeenCalledWith({
        where: { id: 'app-123', userId: 'user-123' },
        include: { jobPosting: false },
      });
    });

    it('should throw NotFoundException if application not found', async () => {
      jest.spyOn(prisma.application, 'findFirst').mockResolvedValue(null);

      await expect(service.findOne('user-123', 'invalid-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return all applications for user', async () => {
      const applications = [
        {
          id: 'app-1',
          userId: 'user-123',
          jobPostingId: 'job-1',
          status: 'READY',
          createdAt: new Date(),
        },
        {
          id: 'app-2',
          userId: 'user-123',
          jobPostingId: 'job-2',
          status: 'PENDING',
          createdAt: new Date(),
        },
      ];

      jest.spyOn(prisma.application, 'findMany').mockResolvedValue(applications as any);

      const result = await service.findAll('user-123');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('app-1');
      expect(prisma.application.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        include: { jobPosting: false },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('getFiles', () => {
    it('should return SAS URLs for files', async () => {
      const application = {
        id: 'app-123',
        userId: 'user-123',
        status: 'READY',
        coverLetterFileKey: 'applications/app-123-cover-letter.pdf',
        resumeFileKey: 'applications/app-123-resume.pdf',
      };

      jest.spyOn(prisma.application, 'findFirst').mockResolvedValue(application as any);

      jest.spyOn(storageService, 'getSignedUrl').mockResolvedValue('https://storage.azure.com/...');

      const result = await service.getFiles('user-123', 'app-123');

      expect(result.coverLetter).toBeDefined();
      expect(result.resume).toBeDefined();
      expect(result.coverLetter?.url).toContain('https://');
      expect(storageService.getSignedUrl).toHaveBeenCalledTimes(2);
    });

    it('should throw BadRequestException if application not ready', async () => {
      jest.spyOn(prisma.application, 'findFirst').mockResolvedValue({
        id: 'app-123',
        userId: 'user-123',
        status: 'PENDING',
      } as any);

      await expect(service.getFiles('user-123', 'app-123')).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if application not found', async () => {
      jest.spyOn(prisma.application, 'findFirst').mockResolvedValue(null);

      await expect(service.getFiles('user-123', 'app-123')).rejects.toThrow(NotFoundException);
    });
  });
});
