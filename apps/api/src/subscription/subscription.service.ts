import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionTier, SubscriptionStatus } from '../generated/prisma/client';

/**
 * Tier limits configuration
 * Defines the resource limits for each subscription tier
 */
export interface TierLimits {
  applicationsPerMonth: number;
  interviewSessionsPerMonth: number;
  priority: 'low' | 'normal' | 'high';
  features: {
    customTemplates: boolean;
    prioritySupport: boolean;
    advancedAnalytics: boolean;
    interviewCoach: boolean;
  };
}

export const TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
  FREE: {
    applicationsPerMonth: 5,
    interviewSessionsPerMonth: 0, // No interview sessions for free tier
    priority: 'low',
    features: {
      customTemplates: false,
      prioritySupport: false,
      advancedAnalytics: false,
      interviewCoach: false,
    },
  },
  PREMIUM: {
    applicationsPerMonth: 50,
    interviewSessionsPerMonth: 20,
    priority: 'normal',
    features: {
      customTemplates: true,
      prioritySupport: false,
      advancedAnalytics: true,
      interviewCoach: true,
    },
  },
  PREMIUM_PLUS: {
    applicationsPerMonth: -1, // Unlimited
    interviewSessionsPerMonth: -1, // Unlimited
    priority: 'high',
    features: {
      customTemplates: true,
      prioritySupport: true,
      advancedAnalytics: true,
      interviewCoach: true,
    },
  },
};

/**
 * Tier hierarchy for comparison
 * Higher number = higher tier
 */
const TIER_HIERARCHY: Record<SubscriptionTier, number> = {
  FREE: 0,
  PREMIUM: 1,
  PREMIUM_PLUS: 2,
};

export interface CanPerformActionResult {
  allowed: boolean;
  reason?: string;
  remaining: number;
  limit: number;
}

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get or create subscription for a user
   * Automatically creates FREE tier if no subscription exists
   */
  async getOrCreateSubscription(userId: string) {
    let subscription = await this.prisma.subscription.findUnique({
      where: { userId },
      include: { usage: true },
    });

    if (!subscription) {
      // Create default FREE subscription with usage tracking
      const now = new Date();
      const periodEnd = this.getNextPeriodEnd(now);

      subscription = await this.prisma.subscription.create({
        data: {
          userId,
          tier: SubscriptionTier.FREE,
          status: SubscriptionStatus.ACTIVE,
          usage: {
            create: {
              periodStart: now,
              periodEnd,
              applicationsUsed: 0,
              interviewSessionsUsed: 0,
            },
          },
        },
        include: { usage: true },
      });

      this.logger.log(`Created FREE subscription for user ${userId}`);
    }

    return subscription;
  }

  /**
   * Get user's current subscription tier
   */
  async getUserTier(userId: string): Promise<SubscriptionTier> {
    const subscription = await this.getOrCreateSubscription(userId);
    // If subscription is not active, treat as FREE
    if (
      subscription.status !== SubscriptionStatus.ACTIVE &&
      subscription.status !== SubscriptionStatus.TRIALING
    ) {
      return SubscriptionTier.FREE;
    }

    return subscription.tier;
  }

  /**
   * Check if user has at least the required tier
   * Respects tier hierarchy: FREE < PREMIUM < PREMIUM_PLUS
   */
  async hasTier(userId: string, requiredTier: SubscriptionTier): Promise<boolean> {
    const userTier = await this.getUserTier(userId);
    return TIER_HIERARCHY[userTier] >= TIER_HIERARCHY[requiredTier];
  }

  /**
   * Get limits for a specific tier
   */
  getTierLimits(tier: SubscriptionTier): TierLimits {
    return TIER_LIMITS[tier];
  }

  /**
   * Check if user can perform an action based on their usage limits
   */
  async canPerformAction(
    userId: string,
    action: 'application' | 'interview',
  ): Promise<CanPerformActionResult> {
    const subscription = await this.getOrCreateSubscription(userId);
    const limits = this.getTierLimits(subscription.tier);

    // Ensure usage period is current
    const usage = await this.ensureCurrentUsagePeriod(subscription.id);

    let used: number;
    let limit: number;
    let actionName: string;

    if (action === 'application') {
      used = usage.applicationsUsed;
      limit = limits.applicationsPerMonth;
      actionName = 'Bewerbungen';
    } else {
      used = usage.interviewSessionsUsed;
      limit = limits.interviewSessionsPerMonth;
      actionName = 'Interview-Sessions';
    }

    // -1 means unlimited
    if (limit === -1) {
      return {
        allowed: true,
        remaining: -1, // Unlimited
        limit: -1,
      };
    }

    const remaining = Math.max(0, limit - used);

    if (remaining <= 0) {
      return {
        allowed: false,
        reason: `Du hast dein monatliches Limit von ${limit} ${actionName} erreicht. Upgrade für mehr.`,
        remaining: 0,
        limit,
      };
    }

    return {
      allowed: true,
      remaining,
      limit,
    };
  }

  /**
   * Record usage for an action
   * Call this after successfully completing the action
   */
  async recordUsage(userId: string, action: 'application' | 'interview'): Promise<void> {
    const subscription = await this.getOrCreateSubscription(userId);
    const usage = await this.ensureCurrentUsagePeriod(subscription.id);

    if (action === 'application') {
      await this.prisma.subscriptionUsage.update({
        where: { id: usage.id },
        data: { applicationsUsed: { increment: 1 } },
      });
    } else {
      await this.prisma.subscriptionUsage.update({
        where: { id: usage.id },
        data: { interviewSessionsUsed: { increment: 1 } },
      });
    }

    this.logger.debug(`Recorded ${action} usage for user ${userId}`);
  }

  /**
   * Get current usage statistics for a user
   */
  async getUsageStats(userId: string) {
    const subscription = await this.getOrCreateSubscription(userId);
    const usage = await this.ensureCurrentUsagePeriod(subscription.id);
    const limits = this.getTierLimits(subscription.tier);

    return {
      tier: subscription.tier,
      status: subscription.status,
      applications: {
        used: usage.applicationsUsed,
        limit: limits.applicationsPerMonth,
        remaining:
          limits.applicationsPerMonth === -1
            ? -1
            : Math.max(0, limits.applicationsPerMonth - usage.applicationsUsed),
      },
      interviewSessions: {
        used: usage.interviewSessionsUsed,
        limit: limits.interviewSessionsPerMonth,
        remaining:
          limits.interviewSessionsPerMonth === -1
            ? -1
            : Math.max(0, limits.interviewSessionsPerMonth - usage.interviewSessionsUsed),
      },
      periodStart: usage.periodStart,
      periodEnd: usage.periodEnd,
      features: limits.features,
    };
  }

  /**
   * Check if a specific feature is available for the user's tier
   */
  async hasFeature(userId: string, feature: keyof TierLimits['features']): Promise<boolean> {
    const tier = await this.getUserTier(userId);
    const limits = this.getTierLimits(tier);
    return limits.features[feature];
  }

  /**
   * Get queue priority for user based on their tier
   */
  async getQueuePriority(userId: string): Promise<'low' | 'normal' | 'high'> {
    const tier = await this.getUserTier(userId);
    return this.getTierLimits(tier).priority;
  }

  /**
   * Ensure usage tracking is for current period
   * Resets counters if period has ended
   */
  private async ensureCurrentUsagePeriod(subscriptionId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { usage: true },
    });

    if (!subscription?.usage) {
      // Create usage tracking if missing
      const now = new Date();
      return await this.prisma.subscriptionUsage.create({
        data: {
          subscriptionId,
          periodStart: now,
          periodEnd: this.getNextPeriodEnd(now),
          applicationsUsed: 0,
          interviewSessionsUsed: 0,
        },
      });
    }

    // Check if period has ended
    if (new Date() > subscription.usage.periodEnd) {
      // Reset for new period
      const now = new Date();
      return await this.prisma.subscriptionUsage.update({
        where: { id: subscription.usage.id },
        data: {
          periodStart: now,
          periodEnd: this.getNextPeriodEnd(now),
          applicationsUsed: 0,
          interviewSessionsUsed: 0,
        },
      });
    }

    return subscription.usage;
  }

  /**
   * Calculate next period end date (1 month from now)
   */
  private getNextPeriodEnd(from: Date): Date {
    const periodEnd = new Date(from);
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    return periodEnd;
  }
}
