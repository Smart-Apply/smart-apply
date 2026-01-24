import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ApplicationsService } from '../../applications.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { JobsService } from '../../../jobs/jobs.service';
import { StorageService } from '../../../storage/storage.service';
import { JobType } from '../../../jobs/interfaces/queue.interface';
import { CreateApplicationDto } from '../../dto/create-application.dto';
import { MockHelper } from '../../../../test/helpers/mock.helper';
import { LLMService } from '../../../llm/llm.service';
import { TitleGeneratorService } from '../../title-generator.service';
import { KeywordsService } from '../../../keywords/keywords.service';
import { TemplatesService } from '../../../templates/templates.service';

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
        {
          provide: LLMService,
          useValue: MockHelper.createMockLLMService(),
        },
        {
          provide: TitleGeneratorService,
          useValue: {
            generateTitle: jest.fn().mockResolvedValue('Generated Title'),
          },
        },
        {
          provide: KeywordsService,
          useValue: {
            extractKeywords: jest.fn().mockResolvedValue({ technicalSkills: [] }),
          },
        },
        {
          provide: TemplatesService,
          useValue: {
            findDefault: jest.fn().mockResolvedValue({
              id: 'template-1',
              name: 'Modern Professional',
              htmlTemplate: '<html><body>{{candidateName}}</body></html>',
              cssStyles: 'body { font-family: Arial; }',
              language: 'en',
            }),
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
        userId: 'user-123',
        title: 'Test Job',
        company: 'Test Co',
        location: null,
        fullText: 'Test job description with requirements and responsibilities',
        rawText: null,
        sourceUrl: null,
        fileId: null,
        language: 'en',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });

      jest.spyOn(prisma.profile, 'findUnique').mockResolvedValue({
        id: 'profile-123',
        userId,
        summary: 'Test summary',
        phone: null,
        location: null,
        linkedinUrl: null,
        githubUrl: null,
        portfolioUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: {
          id: userId,
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          password: 'hashed',
          provider: 'local',
          providerId: null,
          createdAt: new Date(),
        },
        skills: [
          {
            id: 'skill-1',
            profileId: 'profile-123',
            name: 'TypeScript',
            level: 'EXPERT',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'skill-2',
            profileId: 'profile-123',
            name: 'React',
            level: 'ADVANCED',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        experiences: [
          {
            id: 'exp-1',
            profileId: 'profile-123',
            title: 'Senior Developer',
            company: 'Tech Corp',
            location: 'Berlin',
            startDate: new Date('2020-01-01'),
            endDate: null,
            current: true,
            description: 'Building awesome apps',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        education: [
          {
            id: 'edu-1',
            profileId: 'profile-123',
            degree: 'Bachelor of Science',
            field: 'Computer Science',
            institution: 'Tech University',
            location: 'Berlin',
            startDate: new Date('2015-09-01'),
            endDate: new Date('2019-06-01'),
            current: false,
            description: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        projects: [
          {
            id: 'proj-1',
            profileId: 'profile-123',
            name: 'Smart Apply',
            description: 'Job application automation tool',
            url: 'https://github.com/test/smart-apply',
            technologies: ['TypeScript', 'React', 'Node.js'],
            startDate: new Date('2024-01-01'),
            endDate: null,
            current: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        certificates: [
          {
            id: 'cert-1',
            profileId: 'profile-123',
            name: 'AWS Certified Developer',
            issuer: 'Amazon Web Services',
            issueDate: new Date('2023-05-01'),
            expiryDate: null,
            credentialId: 'AWS-123456',
            credentialUrl: 'https://aws.amazon.com/verify',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        languages: [
          {
            id: 'lang-1',
            profileId: 'profile-123',
            name: 'English',
            proficiency: 'Native',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'lang-2',
            profileId: 'profile-123',
            name: 'German',
            proficiency: 'Fluent',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      } as any);

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

      const result = await service.create(userId, dto);

      expect(result.id).toBe('app-123');
      expect(result.status).toBe('PENDING');
      // Note: create() no longer publishes jobs - it just creates the application record
      expect(prisma.application.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId,
            jobPostingId: dto.jobPostingId,
            status: 'PENDING',
          }),
        }),
      );
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

    // Note: Test removed because create() no longer publishes jobs.
    // The method now only creates the application record without queueing background jobs.
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
