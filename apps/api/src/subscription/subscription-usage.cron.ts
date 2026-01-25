import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '../config/config.service';

/**
 * Cron job for subscription usage reset
 * Resets usage counters when billing period ends
 */
@Injectable()
export class SubscriptionUsageCron {
  private readonly logger = new Logger(SubscriptionUsageCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Reset usage counters for subscriptions where the billing period has ended
   * Runs hourly to catch any period endings (ensures we don't miss overnight resets)
   */
  @Cron(CronExpression.EVERY_HOUR)
  async resetExpiredUsagePeriods() {
    // Skip if cron jobs are disabled (e.g., in local development)
    if (!this.configService.enableCronJobs) {
      this.logger.debug('Subscription usage reset skipped (ENABLE_CRON_JOBS=false)');
      return;
    }

    this.logger.log('Starting subscription usage reset check...');
    const startTime = Date.now();

    try {
      const now = new Date();

      // Find all usage records where the period has ended
      const expiredUsage = await this.prisma.subscriptionUsage.findMany({
        where: {
          periodEnd: { lte: now },
        },
        include: {
          subscription: {
            select: { userId: true, tier: true },
          },
        },
      });

      if (expiredUsage.length === 0) {
        this.logger.debug('No expired usage periods found');
        return;
      }

      // Reset each expired usage record
      const resetPromises = expiredUsage.map((usage) => {
        const newPeriodStart = now;
        const newPeriodEnd = new Date(now);
        newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);

        return this.prisma.subscriptionUsage.update({
          where: { id: usage.id },
          data: {
            applicationsUsed: 0,
            interviewSessionsUsed: 0,
            periodStart: newPeriodStart,
            periodEnd: newPeriodEnd,
          },
        });
      });

      await Promise.all(resetPromises);

      const duration = Date.now() - startTime;
      this.logger.log(
        `Subscription usage reset completed. Reset ${expiredUsage.length} subscriptions in ${duration}ms`,
      );

      // Log details for each reset subscription
      expiredUsage.forEach((usage) => {
        this.logger.debug(
          `Reset usage for user ${usage.subscription.userId} (tier: ${usage.subscription.tier}): ` +
            `applications: ${usage.applicationsUsed} → 0, interviews: ${usage.interviewSessionsUsed} → 0`,
        );
      });
    } catch (error) {
      this.logger.error('Subscription usage reset failed', error);
    }
  }

  /**
   * Manual method to reset usage for a specific subscription
   * Can be called from admin endpoints if needed
   */
  async resetUsageForSubscription(subscriptionId: string): Promise<void> {
    const now = new Date();
    const newPeriodEnd = new Date(now);
    newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);

    await this.prisma.subscriptionUsage.update({
      where: { subscriptionId },
      data: {
        applicationsUsed: 0,
        interviewSessionsUsed: 0,
        periodStart: now,
        periodEnd: newPeriodEnd,
      },
    });

    this.logger.log(`Manually reset usage for subscription ${subscriptionId}`);
  }

  /**
   * Reset all usage counters (for admin use, e.g., during testing)
   */
  async resetAllUsage(): Promise<number> {
    const now = new Date();
    const newPeriodEnd = new Date(now);
    newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);

    const result = await this.prisma.subscriptionUsage.updateMany({
      data: {
        applicationsUsed: 0,
        interviewSessionsUsed: 0,
        periodStart: now,
        periodEnd: newPeriodEnd,
      },
    });

    this.logger.log(`Reset all usage counters: ${result.count} subscriptions affected`);
    return result.count;
  }
}
