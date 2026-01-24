import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '../../config/config.service';

/**
 * Cleanup cron job for soft-deleted items
 * Hard deletes items that have been soft-deleted for more than 30 days
 */
@Injectable()
export class CleanupCron {
  private readonly logger = new Logger(CleanupCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Clean up soft-deleted applications older than 30 days
   * Runs daily at midnight
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupDeletedApplications() {
    // Skip if cron jobs are disabled (e.g., in local development)
    if (!this.configService.enableCronJobs) {
      this.logger.debug('Application cleanup skipped (ENABLE_CRON_JOBS=false)');
      return;
    }

    this.logger.log('Starting soft-deleted applications cleanup...');
    const startTime = Date.now();

    try {
      // Calculate cutoff date (30 days ago)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      // Hard delete applications that were soft-deleted more than 30 days ago
      const result = await this.prisma.application.deleteMany({
        where: {
          deletedAt: {
            not: null,
            lt: thirtyDaysAgo,
          },
        },
      });

      const duration = Date.now() - startTime;

      this.logger.log(
        `Application cleanup completed. Deleted ${result.count} applications older than 30 days in ${duration}ms`,
      );
    } catch (error) {
      this.logger.error('Application cleanup failed', error);
    }
  }

  /**
   * Clean up soft-deleted job postings older than 30 days
   * Runs daily at 12:05 AM (5 minutes after applications cleanup to avoid DB contention)
   */
  @Cron('5 0 * * *') // 00:05 every day
  async cleanupDeletedJobPostings() {
    // Skip if cron jobs are disabled (e.g., in local development)
    if (!this.configService.enableCronJobs) {
      this.logger.debug('Job postings cleanup skipped (ENABLE_CRON_JOBS=false)');
      return;
    }

    this.logger.log('Starting soft-deleted job postings cleanup...');
    const startTime = Date.now();

    try {
      // Calculate cutoff date (30 days ago)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      // Hard delete job postings that were soft-deleted more than 30 days ago
      const result = await this.prisma.jobPosting.deleteMany({
        where: {
          deletedAt: {
            not: null,
            lt: thirtyDaysAgo,
          },
        },
      });

      const duration = Date.now() - startTime;

      this.logger.log(
        `Job postings cleanup completed. Deleted ${result.count} job postings older than 30 days in ${duration}ms`,
      );
    } catch (error) {
      this.logger.error('Job postings cleanup failed', error);
    }
  }

  /**
   * Refresh materialized views for dashboard statistics
   * Runs every 5 minutes to keep stats relatively fresh
   */
  @Cron('*/5 * * * *') // Every 5 minutes
  async refreshMaterializedViews() {
    // Skip if cron jobs are disabled (e.g., in local development)
    if (!this.configService.enableCronJobs) {
      this.logger.debug('Materialized views refresh skipped (ENABLE_CRON_JOBS=false)');
      return;
    }

    this.logger.debug('Refreshing materialized views...');
    const startTime = Date.now();

    try {
      await this.prisma.refreshMaterializedViews();
      const duration = Date.now() - startTime;
      this.logger.debug(`Materialized views refreshed in ${duration}ms`);
    } catch (error) {
      this.logger.error('Materialized views refresh failed', error);
    }
  }
}
