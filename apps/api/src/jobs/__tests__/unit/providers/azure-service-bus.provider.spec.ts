import { Test, TestingModule } from '@nestjs/testing';
import { AzureServiceBusProvider } from '../../../providers/azure-service-bus.provider';
import { ConfigService } from '../../../../config/config.service';
import { PrismaService } from '../../../../prisma/prisma.service';
import { JobType, JobStatus } from '../../../interfaces/queue.interface';
import { BackgroundJobStatus } from '../../../../generated/prisma/client';

// Mock @azure/service-bus
jest.mock('@azure/service-bus', () => ({
  ServiceBusClient: jest.fn().mockImplementation(() => ({
    createSender: jest.fn().mockReturnValue({
      sendMessages: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
    }),
    createReceiver: jest.fn().mockReturnValue({
      subscribe: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
    }),
    close: jest.fn().mockResolvedValue(undefined),
  })),
}));

describe('AzureServiceBusProvider', () => {
  let provider: AzureServiceBusProvider;
  let mockPrismaService: Partial<PrismaService>;
  let mockConfigService: Partial<ConfigService>;

  beforeEach(async () => {
    mockPrismaService = {
      backgroundJob: {
        create: jest.fn().mockResolvedValue({ id: 'test-job-id' }),
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
      },
    } as any;

    mockConfigService = {
      serviceBusConnectionString:
        'Endpoint=sb://test.servicebus.windows.net/;SharedAccessKeyName=test;SharedAccessKey=test',
      serviceBusQueueName: 'test-queue',
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: AzureServiceBusProvider,
          useFactory: () =>
            new AzureServiceBusProvider(
              mockConfigService as ConfigService,
              mockPrismaService as PrismaService,
            ),
        },
      ],
    }).compile();

    provider = module.get<AzureServiceBusProvider>(AzureServiceBusProvider);
  });

  describe('publish', () => {
    it('should publish a job and persist to database', async () => {
      const jobId = await provider.publish(JobType.APPLICATION_GENERATE, {
        applicationId: 'app-123',
      });

      expect(jobId).toMatch(/^job-\d+-\w+$/);
      expect(mockPrismaService.backgroundJob?.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: JobType.APPLICATION_GENERATE,
          status: BackgroundJobStatus.PENDING,
          data: { applicationId: 'app-123' },
          maxRetries: 5,
        }),
      });
    });
  });

  describe('getJob', () => {
    it('should return null when job not found', async () => {
      const job = await provider.getJob('non-existent');
      expect(job).toBeNull();
    });

    it('should return job from database when found', async () => {
      const mockDbJob = {
        id: 'test-job-id',
        type: JobType.APPLICATION_GENERATE,
        status: BackgroundJobStatus.COMPLETED,
        data: { applicationId: 'app-123' },
        error: null,
        retryCount: 0,
        maxRetries: 5,
        createdAt: new Date(),
        startedAt: new Date(),
        completedAt: new Date(),
        updatedAt: new Date(),
        deadLetterReason: null,
        deadLetteredAt: null,
      };

      (mockPrismaService.backgroundJob?.findUnique as jest.Mock).mockResolvedValue(mockDbJob);

      const job = await provider.getJob('test-job-id');

      expect(job).toEqual(
        expect.objectContaining({
          id: 'test-job-id',
          type: JobType.APPLICATION_GENERATE,
          status: JobStatus.COMPLETED,
        }),
      );
    });

    it('should map DEAD_LETTERED status to FAILED', async () => {
      const mockDbJob = {
        id: 'test-job-id',
        type: JobType.APPLICATION_GENERATE,
        status: BackgroundJobStatus.DEAD_LETTERED,
        data: {},
        error: 'Max retries exceeded',
        retryCount: 5,
        maxRetries: 5,
        createdAt: new Date(),
        startedAt: new Date(),
        completedAt: new Date(),
        updatedAt: new Date(),
        deadLetterReason: 'MaxDeliveryCountExceeded',
        deadLetteredAt: new Date(),
      };

      (mockPrismaService.backgroundJob?.findUnique as jest.Mock).mockResolvedValue(mockDbJob);

      const job = await provider.getJob('test-job-id');

      expect(job?.status).toBe(JobStatus.FAILED);
      expect(job?.error).toBe('Max retries exceeded');
    });
  });

  describe('healthCheck', () => {
    it('should return true when Service Bus is healthy', async () => {
      const isHealthy = await provider.healthCheck();
      expect(isHealthy).toBe(true);
    });
  });
});
