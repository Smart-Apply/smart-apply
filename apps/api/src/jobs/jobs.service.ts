import { Injectable, Logger, OnModuleInit, Inject } from '@nestjs/common';
import { QueueProvider, JobType, Job } from './interfaces/queue.interface';
import { ApplicationProcessor } from './processors/application.processor';

@Injectable()
export class JobsService implements OnModuleInit {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    @Inject('QUEUE_PROVIDER')
    private readonly queueProvider: QueueProvider,
    private readonly applicationProcessor: ApplicationProcessor,
  ) {}

  async onModuleInit() {
    // Register job handlers
    await this.registerHandlers();
    this.logger.log('Job handlers registered');
  }

  private async registerHandlers() {
    // Register APPLICATION_GENERATE handler
    await this.queueProvider.subscribe(
      JobType.APPLICATION_GENERATE,
      async (job: Job) => {
        this.logger.log(`Processing job ${job.id}: ${job.type}`);
        await this.applicationProcessor.process(job);
      },
    );
  }

  /**
   * Publish a new job to the queue
   */
  async publishJob<T>(type: JobType, data: T): Promise<string> {
    const jobId = await this.queueProvider.publish(type, data);
    this.logger.log(`Job ${jobId} published: ${type}`);
    return jobId;
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<Job | null> {
    return this.queueProvider.getJob(jobId);
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    return this.queueProvider.healthCheck();
  }
}
