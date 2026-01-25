import { Module, Global } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SubscriptionService } from './subscription.service';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionUsageCron } from './subscription-usage.cron';

/**
 * SubscriptionModule
 *
 * Provides subscription tier management and usage tracking.
 * Marked as @Global() to make SubscriptionService available
 * throughout the application without explicit imports.
 *
 * Usage:
 * - TierGuard uses this to check tier requirements
 * - UsageLimitGuard uses this to check usage limits
 * - Controllers can inject SubscriptionService for custom logic
 *
 * Features:
 * - Tier management (FREE, PREMIUM, PREMIUM_PLUS)
 * - Usage tracking (applications, interview sessions)
 * - Automatic usage reset via cron job
 */
@Global()
@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [SubscriptionController],
  providers: [SubscriptionService, SubscriptionUsageCron],
  exports: [SubscriptionService, SubscriptionUsageCron],
})
export class SubscriptionModule {}
