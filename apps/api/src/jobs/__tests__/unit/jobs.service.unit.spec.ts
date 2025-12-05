import { Test, TestingModule } from '@nestjs/testing';
import { JobsService } from '../../jobs.service';
import { InMemoryQueueProvider } from '../../providers/in-memory-queue.provider';
import { ApplicationProcessor } from '../../processors/application.processor';
import { JobType, JobStatus } from '../../interfaces/queue.interface';
import { PrismaService } from '../../../prisma/prisma.service';
import { LLMService } from '../../../llm/llm.service';
import { PdfService } from '../../../pdf/pdf.service';
import { StorageService } from '../../../storage/storage.service';
import { TemplatesService } from '../../../templates/templates.service';

// Extend Jest matchers
interface CustomMatchers<R = unknown> {
  toBeOneOf(expected: any[]): R;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Expect extends CustomMatchers {}
    interface Matchers<R> extends CustomMatchers<R> {}
    interface InverseAsymmetricMatchers extends CustomMatchers {}
  }
}

describe('JobsService', () => {
  let service: JobsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobsService,
        ApplicationProcessor,
        InMemoryQueueProvider,
        {
          provide: 'QUEUE_PROVIDER',
          useClass: InMemoryQueueProvider,
        },
        {
          provide: PrismaService,
          useValue: {
            application: {
              update: jest.fn(),
            },
            profile: {
              findUnique: jest.fn(),
            },
            jobPosting: {
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: LLMService,
          useValue: {
            generateCoverLetter: jest.fn().mockResolvedValue('<html>Cover Letter</html>'),
            generateResume: jest.fn().mockResolvedValue('<html>Resume</html>'),
          },
        },
        {
          provide: PdfService,
          useValue: {
            generatePDF: jest.fn().mockResolvedValue(Buffer.from('PDF content')),
          },
        },
        {
          provide: StorageService,
          useValue: {
            upload: jest.fn().mockResolvedValue('mock-file-key'),
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
            }),
          },
        },
      ],
    }).compile();

    service = module.get<JobsService>(JobsService);

    // Initialize the service to register handlers
    await service.onModuleInit();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('publishJob', () => {
    it('should publish a job and return job ID', async () => {
      const jobData = {
        applicationId: 'app-123',
        userId: 'user-123',
        jobPostingId: 'job-123',
      };

      const jobId = await service.publishJob(JobType.APPLICATION_GENERATE, jobData);

      expect(jobId).toBeDefined();
      expect(jobId).toMatch(/^job-/);
    });
  });

  describe('getJobStatus', () => {
    it('should return job status', async () => {
      const jobData = {
        applicationId: 'app-123',
        userId: 'user-123',
        jobPostingId: 'job-123',
      };

      const jobId = await service.publishJob(JobType.APPLICATION_GENERATE, jobData);

      const job = await service.getJobStatus(jobId);

      expect(job).toBeDefined();
      expect(job?.id).toBe(jobId);
      expect(job?.type).toBe(JobType.APPLICATION_GENERATE);
      expect(job?.status).toBeOneOf([
        JobStatus.PENDING,
        JobStatus.PROCESSING,
        JobStatus.COMPLETED,
        JobStatus.FAILED,
      ]);
    });

    it('should return null for non-existent job', async () => {
      const job = await service.getJobStatus('non-existent-job');
      expect(job).toBeNull();
    });
  });

  describe('healthCheck', () => {
    it('should return true for in-memory provider', async () => {
      const isHealthy = await service.healthCheck();
      expect(isHealthy).toBe(true);
    });
  });
});

// Custom Jest matcher
expect.extend({
  toBeOneOf(received, expected) {
    const pass = expected.includes(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be one of ${expected.join(', ')}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be one of ${expected.join(', ')}`,
        pass: false,
      };
    }
  },
});
