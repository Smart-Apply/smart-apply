export enum JobType {
  APPLICATION_GENERATE = 'application:generate',
  // Future: APPLICATION_REGENERATE, PROFILE_SYNC, etc.
}

export enum JobStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export interface Job<T = any> {
  id: string;
  type: JobType;
  data: T;
  status: JobStatus;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  retryCount?: number;
}

export interface QueueProvider {
  /**
   * Publish a job to the queue
   */
  publish<T>(type: JobType, data: T): Promise<string>;

  /**
   * Subscribe to jobs and process them
   */
  subscribe(
    type: JobType,
    handler: (job: Job) => Promise<void>,
  ): Promise<void>;

  /**
   * Get job status by ID
   */
  getJob(jobId: string): Promise<Job | null>;

  /**
   * Health check
   */
  healthCheck(): Promise<boolean>;
}
