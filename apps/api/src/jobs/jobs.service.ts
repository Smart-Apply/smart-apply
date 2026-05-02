import { Injectable, Logger, OnModuleInit, Inject } from '@nestjs/common';
import { QueueProvider, JobType, Job, JobStatus } from './interfaces/queue.interface';
import { ApplicationProcessor } from './processors/application.processor';
import { PrismaService } from '../prisma/prisma.service';
import { BackgroundJobStatus } from '../generated/prisma/client';

@Injectable()
export class JobsService implements OnModuleInit {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    @Inject('QUEUE_PROVIDER')
    private readonly queueProvider: QueueProvider,
    private readonly applicationProcessor: ApplicationProcessor,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    // Register job handlers
    await this.registerHandlers();
    this.logger.log('Job handlers registered');
  }

  private async registerHandlers() {
    // Register APPLICATION_GENERATE handler
    await this.queueProvider.subscribe(JobType.APPLICATION_GENERATE, async (job: Job) => {
      this.logger.log(`Processing job ${job.id}: ${job.type}`);
      await this.applicationProcessor.process(job);
    });
  }

  /**
   * Publish a new job to the queue
   * For in-memory provider, also persists to database for status tracking
   */
  async publishJob<T>(type: JobType, data: T): Promise<string> {
    const jobId = await this.queueProvider.publish(type, data);
    this.logger.log(`Job ${jobId} published: ${type}`);

    // Persist a tracking row so the SSE/status endpoints can report
    // PENDING/RUNNING/COMPLETED. Both supported drivers (in-memory and
    // QStash) rely on this row — there's no provider-managed status store.
    try {
      await this.prisma.backgroundJob.create({
        data: {
          id: jobId,
          type,
          status: BackgroundJobStatus.PENDING,
          data: data as object,
          maxRetries: 3,
        },
      });
    } catch (error) {
      this.logger.warn(`Failed to create job record: ${error}`);
    }

    return jobId;
  }

  /**
   * Get job status by ID
   * First tries database, then falls back to queue provider
   */
  async getJobStatus(jobId: string): Promise<Job | null> {
    // Try database first for persistent status
    try {
      const dbJob = await this.prisma.backgroundJob.findUnique({
        where: { id: jobId },
      });

      if (dbJob) {
        return this.convertDbJobToJob(dbJob);
      }
    } catch (error) {
      this.logger.warn(`Failed to query job from database: ${error}`);
    }

    // Fall back to queue provider
    return this.queueProvider.getJob(jobId);
  }

  /**
   * Update job status (for in-memory provider integration)
   */
  async updateJobStatus(
    jobId: string,
    status: BackgroundJobStatus,
    extra?: { error?: string; result?: object },
  ): Promise<void> {
    try {
      const updateData: {
        status: BackgroundJobStatus;
        error?: string;
        result?: object;
        startedAt?: Date;
        completedAt?: Date;
      } = { status };

      if (status === BackgroundJobStatus.PROCESSING) {
        updateData.startedAt = new Date();
      }

      if (
        status === BackgroundJobStatus.COMPLETED ||
        status === BackgroundJobStatus.FAILED ||
        status === BackgroundJobStatus.DEAD_LETTERED
      ) {
        updateData.completedAt = new Date();
      }

      if (extra?.error) {
        updateData.error = extra.error;
      }

      if (extra?.result) {
        updateData.result = extra.result;
      }

      await this.prisma.backgroundJob.update({
        where: { id: jobId },
        data: updateData,
      });
    } catch (error) {
      this.logger.warn(`Failed to update job status for ${jobId}: ${error}`);
    }
  }

  /**
   * List jobs with optional filtering
   */
  async listJobs(options?: {
    type?: JobType;
    status?: BackgroundJobStatus;
    limit?: number;
    offset?: number;
  }): Promise<{ jobs: Job[]; total: number }> {
    const where: { type?: string; status?: BackgroundJobStatus } = {};

    if (options?.type) {
      where.type = options.type;
    }

    if (options?.status) {
      where.status = options.status;
    }

    const [jobs, total] = await Promise.all([
      this.prisma.backgroundJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options?.limit || 50,
        skip: options?.offset || 0,
      }),
      this.prisma.backgroundJob.count({ where }),
    ]);

    return {
      jobs: jobs.map((job) => this.convertDbJobToJob(job)),
      total,
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    return this.queueProvider.healthCheck();
  }

  /**
   * Convert database job to Job interface
   */
  private convertDbJobToJob(dbJob: {
    id: string;
    type: string;
    status: BackgroundJobStatus;
    data: unknown;
    error: string | null;
    retryCount: number;
    createdAt: Date;
    startedAt: Date | null;
    completedAt: Date | null;
  }): Job {
    const statusMap: Record<BackgroundJobStatus, JobStatus> = {
      [BackgroundJobStatus.PENDING]: JobStatus.PENDING,
      [BackgroundJobStatus.PROCESSING]: JobStatus.PROCESSING,
      [BackgroundJobStatus.COMPLETED]: JobStatus.COMPLETED,
      [BackgroundJobStatus.FAILED]: JobStatus.FAILED,
      [BackgroundJobStatus.DEAD_LETTERED]: JobStatus.FAILED,
    };

    return {
      id: dbJob.id,
      type: dbJob.type as JobType,
      data: dbJob.data,
      status: statusMap[dbJob.status],
      createdAt: dbJob.createdAt,
      startedAt: dbJob.startedAt || undefined,
      completedAt: dbJob.completedAt || undefined,
      error: dbJob.error || undefined,
      retryCount: dbJob.retryCount,
    };
  }
}
