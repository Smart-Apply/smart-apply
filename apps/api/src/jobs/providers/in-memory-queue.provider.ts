import { Injectable, Logger } from '@nestjs/common';
import {
  QueueProvider,
  JobType,
  Job,
  JobStatus,
} from '../interfaces/queue.interface';

@Injectable()
export class InMemoryQueueProvider implements QueueProvider {
  private readonly logger = new Logger(InMemoryQueueProvider.name);
  private jobs = new Map<string, Job>();
  private handlers = new Map<JobType, (job: Job) => Promise<void>>();
  private queue: Job[] = [];
  private processing = false;

  async publish<T>(type: JobType, data: T): Promise<string> {
    const jobId = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const job: Job = {
      id: jobId,
      type,
      data,
      status: JobStatus.PENDING,
      createdAt: new Date(),
      retryCount: 0,
    };

    this.jobs.set(jobId, job);
    this.queue.push(job);

    // Trigger processing
    this.processQueue();

    return jobId;
  }

  async subscribe(
    type: JobType,
    handler: (job: Job) => Promise<void>,
  ): Promise<void> {
    this.handlers.set(type, handler);
    this.logger.log(`Handler registered for job type: ${type}`);
  }

  async getJob(jobId: string): Promise<Job | null> {
    return this.jobs.get(jobId) || null;
  }

  async healthCheck(): Promise<boolean> {
    return true; // Always healthy for in-memory
  }

  private async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const job = this.queue.shift();
      if (!job) continue;

      const handler = this.handlers.get(job.type);
      if (!handler) {
        this.logger.warn(`No handler registered for job type: ${job.type}`);
        continue;
      }

      try {
        // Update status to PROCESSING
        job.status = JobStatus.PROCESSING;
        job.startedAt = new Date();
        this.jobs.set(job.id, { ...job });

        // Execute handler
        await handler(job);

        // Update status to COMPLETED
        job.status = JobStatus.COMPLETED;
        job.completedAt = new Date();
        this.jobs.set(job.id, { ...job });

        this.logger.log(`Job ${job.id} completed successfully`);
      } catch (error) {
        // Update status to FAILED
        job.status = JobStatus.FAILED;
        job.completedAt = new Date();
        job.error = error.message;
        this.jobs.set(job.id, { ...job });

        this.logger.error(
          `Job ${job.id} failed: ${error.message}`,
          error.stack,
        );

        // Retry logic (max 3 retries)
        if ((job.retryCount || 0) < 3) {
          job.retryCount = (job.retryCount || 0) + 1;
          job.status = JobStatus.PENDING;
          this.queue.push(job);
          this.logger.log(
            `Job ${job.id} queued for retry (${job.retryCount}/3)`,
          );
        }
      }
    }

    this.processing = false;
  }
}
