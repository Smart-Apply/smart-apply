import { Test, TestingModule } from '@nestjs/testing';
import { InMemoryQueueProvider } from '../../../providers/in-memory-queue.provider';
import { JobType, JobStatus } from '../../../interfaces/queue.interface';

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

describe('InMemoryQueueProvider', () => {
  let provider: InMemoryQueueProvider;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [InMemoryQueueProvider],
    }).compile();

    provider = module.get<InMemoryQueueProvider>(InMemoryQueueProvider);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  describe('publish', () => {
    it('should publish a job and return job ID', async () => {
      const jobData = { test: 'data' };
      const jobId = await provider.publish(JobType.APPLICATION_GENERATE, jobData);

      expect(jobId).toBeDefined();
      expect(jobId).toMatch(/^job-/);
    });

    it('should create a job with correct properties', async () => {
      const jobData = { test: 'data' };
      const jobId = await provider.publish(JobType.APPLICATION_GENERATE, jobData);

      const job = await provider.getJob(jobId);

      expect(job).toBeDefined();
      expect(job?.id).toBe(jobId);
      expect(job?.type).toBe(JobType.APPLICATION_GENERATE);
      expect(job?.data).toEqual(jobData);
      expect(job?.status).toBeOneOf([JobStatus.PENDING, JobStatus.PROCESSING]);
      expect(job?.createdAt).toBeInstanceOf(Date);
      expect(job?.retryCount).toBe(0);
    });
  });

  describe('subscribe', () => {
    it('should register a handler for a job type', async () => {
      const handler = jest.fn().mockResolvedValue(undefined);

      await provider.subscribe(JobType.APPLICATION_GENERATE, handler);

      // Handler should be registered
      // We can't directly test the handlers map, but we can test by publishing a job
      const jobData = { test: 'data' };
      await provider.publish(JobType.APPLICATION_GENERATE, jobData);

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(handler).toHaveBeenCalled();
    });

    it('should process jobs with registered handler', async () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      await provider.subscribe(JobType.APPLICATION_GENERATE, handler);

      const jobData = { test: 'data' };
      const jobId = await provider.publish(JobType.APPLICATION_GENERATE, jobData);

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      const job = await provider.getJob(jobId);
      expect(job?.status).toBe(JobStatus.COMPLETED);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          id: jobId,
          type: JobType.APPLICATION_GENERATE,
          data: jobData,
        }),
      );
    });

    it('should handle job failures and retry', async () => {
      let callCount = 0;
      const handler = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          throw new Error('Test error');
        }
        return Promise.resolve();
      });

      await provider.subscribe(JobType.APPLICATION_GENERATE, handler);

      const jobData = { test: 'data' };
      const jobId = await provider.publish(JobType.APPLICATION_GENERATE, jobData);

      // Wait for processing and retries
      await new Promise((resolve) => setTimeout(resolve, 500));

      expect(handler).toHaveBeenCalledTimes(3);
      const job = await provider.getJob(jobId);
      expect(job?.status).toBe(JobStatus.COMPLETED);
    });

    it('should mark job as FAILED after max retries', async () => {
      const handler = jest.fn().mockRejectedValue(new Error('Test error'));

      await provider.subscribe(JobType.APPLICATION_GENERATE, handler);

      const jobData = { test: 'data' };
      const jobId = await provider.publish(JobType.APPLICATION_GENERATE, jobData);

      // Wait for processing and retries
      await new Promise((resolve) => setTimeout(resolve, 500));

      const job = await provider.getJob(jobId);
      expect(job?.status).toBe(JobStatus.FAILED);
      expect(job?.error).toBe('Test error');
      expect(handler).toHaveBeenCalledTimes(4); // Initial + 3 retries
    });
  });

  describe('getJob', () => {
    it('should return job by ID', async () => {
      const jobData = { test: 'data' };
      const jobId = await provider.publish(JobType.APPLICATION_GENERATE, jobData);

      const job = await provider.getJob(jobId);

      expect(job).toBeDefined();
      expect(job?.id).toBe(jobId);
    });

    it('should return null for non-existent job', async () => {
      const job = await provider.getJob('non-existent-job');
      expect(job).toBeNull();
    });
  });

  describe('healthCheck', () => {
    it('should always return true', async () => {
      const isHealthy = await provider.healthCheck();
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
