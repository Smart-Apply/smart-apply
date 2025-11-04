import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ServiceBusClient, ServiceBusReceiver, ServiceBusSender } from '@azure/service-bus';
import { ConfigService } from '../../config/config.service';
import { QueueProvider, JobType, Job, JobStatus } from '../interfaces/queue.interface';

@Injectable()
export class AzureServiceBusProvider implements QueueProvider, OnModuleDestroy {
  private readonly logger = new Logger(AzureServiceBusProvider.name);
  private client: ServiceBusClient;
  private senders = new Map<JobType, ServiceBusSender>();
  private receivers = new Map<JobType, ServiceBusReceiver>();
  private jobs = new Map<string, Job>(); // In-memory cache for status

  constructor(private configService: ConfigService) {
    const connectionString = this.configService.serviceBusConnectionString;

    if (!connectionString) {
      throw new Error('Azure Service Bus connection string not configured');
    }

    this.client = new ServiceBusClient(connectionString);
    this.logger.log('Azure Service Bus client initialized');
  }

  async onModuleDestroy() {
    // Close all senders and receivers
    for (const sender of this.senders.values()) {
      await sender.close();
    }
    for (const receiver of this.receivers.values()) {
      await receiver.close();
    }
    await this.client.close();
    this.logger.log('Azure Service Bus connections closed');
  }

  async publish<T>(type: JobType, data: T): Promise<string> {
    const queueName = this.getQueueName(type);
    const sender = await this.getSender(type);

    const jobId = `job-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

    const job: Job = {
      id: jobId,
      type,
      data,
      status: JobStatus.PENDING,
      createdAt: new Date(),
      retryCount: 0,
    };

    // Cache job for status queries
    this.jobs.set(jobId, job);

    // Send message to Service Bus
    await sender.sendMessages({
      body: job,
      messageId: jobId,
      contentType: 'application/json',
    });

    this.logger.log(`Job ${jobId} published to queue: ${queueName}`);
    return jobId;
  }

  async subscribe(type: JobType, handler: (job: Job) => Promise<void>): Promise<void> {
    const queueName = this.getQueueName(type);
    const receiver = await this.getReceiver(type);

    this.logger.log(`Subscribing to queue: ${queueName}`);

    // Process messages
    receiver.subscribe({
      processMessage: async (message) => {
        const job = message.body as Job;

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

          // Complete message (remove from queue)
          await receiver.completeMessage(message);

          this.logger.log(`Job ${job.id} completed successfully`);
        } catch (error) {
          this.logger.error(`Job ${job.id} failed: ${error.message}`, error.stack);

          // Update status to FAILED
          job.status = JobStatus.FAILED;
          job.completedAt = new Date();
          job.error = error.message;
          this.jobs.set(job.id, { ...job });

          // Abandon message (will be retried by Service Bus)
          await receiver.abandonMessage(message);
        }
      },
      processError: async (error) => {
        this.logger.error('Service Bus error:', error);
      },
    });
  }

  async getJob(jobId: string): Promise<Job | null> {
    return this.jobs.get(jobId) || null;
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Check if client is initialized and connection is healthy
      // For a more comprehensive check, we verify we can create a test sender
      const testSender = this.client.createSender(this.getQueueName(JobType.APPLICATION_GENERATE));
      await testSender.close();
      return true;
    } catch (error) {
      this.logger.error('Service Bus health check failed', error);
      return false;
    }
  }

  private async getSender(type: JobType): Promise<ServiceBusSender> {
    if (!this.senders.has(type)) {
      const queueName = this.getQueueName(type);
      const sender = this.client.createSender(queueName);
      this.senders.set(type, sender);
    }
    return this.senders.get(type)!;
  }

  private async getReceiver(type: JobType): Promise<ServiceBusReceiver> {
    if (!this.receivers.has(type)) {
      const queueName = this.getQueueName(type);
      const receiver = this.client.createReceiver(queueName, {
        receiveMode: 'peekLock',
      });
      this.receivers.set(type, receiver);
    }
    return this.receivers.get(type)!;
  }

  private getQueueName(type: JobType): string {
    // Convert job type to Azure Service Bus compliant queue name
    // Azure queue names must be lowercase alphanumeric with hyphens
    // and cannot start or end with a hyphen
    return type.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  }
}
