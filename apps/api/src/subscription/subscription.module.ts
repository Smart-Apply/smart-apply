import { Module, Global } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { SubscriptionController } from './subscription.controller';

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
 */
@Global()
@Module({
  controllers: [SubscriptionController],
  providers: [SubscriptionService],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
