import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionTier, SubscriptionStatus } from '../generated/prisma/client';
import type { SubscriptionUsage } from '../generated/prisma/client';

/**
 * Tier limits configuration
 * Defines the resource limits for each subscription tier
 *
 * Pricing Model (value-positioned, not feature-count-positioned):
 * - FREE (€0):            Risk-free entry. 3 applications/month so users can try Smart Apply.
 * - PRO (€9.99/month):    Optimise every application with AI. Templates, ATS-Optimisation,
 *                        keyword matching, analytics, integrated job search.
 * - PREMIUM (€19.99/month): Automate the job search. Auto-Apply agent, automatic email-based
 *                        tracking, interview coach, advanced analytics, priority queue.
 *
 * Note: the numeric per-month caps below are cost-protection ceilings and intentionally
 * not part of the marketing copy. Users see value-oriented benefits, not application counts.
 */
export interface TierLimits {
  // Generation limits
  coverLettersPerMonth: number; // -1 = unlimited
  resumesPerMonth: number; // -1 = unlimited
  jobParsingPerMonth: number; // URL parsing limit
  interviewSessionsPerMonth: number;

  // Auto-Apply: hard cap on approvals per billing period (cost protection).
  // 0 disables the feature, -1 = unlimited. Defaults to 50 on PREMIUM.
  autoApplyApprovalsPerMonth: number;

  // Cost-protection cap (rolling 24h window): one "application" =
  // create-with-generation call. -1 = unlimited.
  applicationsPerDay: number;

  // Queue priority
  priority: 'low' | 'normal' | 'high';

  // Features available
  features: {
    // Templates
    pdfExport: boolean; // Can download PDFs
    multipleTemplates: boolean; // Access to multiple templates
    premiumTemplates: boolean; // Access to premium/custom templates
    customBranding: boolean; // Own colors, logo, layout

    // ATS & Keywords
    atsOptimization: boolean; // ATS score & optimization
    keywordMatching: 'none' | 'basic' | 'semantic'; // Keyword matching level

    // Tracking & Analytics
    applicationTracking: 'manual' | 'semi-auto' | 'auto'; // Tracking level
    basicAnalytics: boolean; // Basic stats
    advancedAnalytics: boolean; // Trends, company comparison, success rates

    // Profile & Import
    extendedProfile: boolean; // More projects, experiences, etc.
    linkedinImport: boolean; // Import from LinkedIn

    // Languages
    multiLanguage: 'none' | 'de-en' | 'all'; // Cover letter languages

    // Premium features
    interviewCoach: boolean; // KI Interview Coach
    autoApplyAgent: boolean; // Auto-apply bot
    emailParsing: boolean; // Gmail/Outlook tracking
    prioritySupport: boolean; // Premium support
    noAds: boolean; // Ad-free experience
  };
}

export const TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
  FREE: {
    coverLettersPerMonth: 3,
    resumesPerMonth: 3,
    jobParsingPerMonth: 10,
    interviewSessionsPerMonth: 0,
    autoApplyApprovalsPerMonth: 0,
    applicationsPerDay: 5,
    priority: 'low',
    features: {
      pdfExport: false,
      multipleTemplates: false,
      premiumTemplates: false,
      customBranding: false,
      atsOptimization: false,
      keywordMatching: 'none',
      applicationTracking: 'manual',
      basicAnalytics: false,
      advancedAnalytics: false,
      extendedProfile: false,
      linkedinImport: false,
      multiLanguage: 'none',
      interviewCoach: false,
      autoApplyAgent: false,
      emailParsing: false,
      prioritySupport: false,
      noAds: false,
    },
  },
  PRO: {
    coverLettersPerMonth: 50,
    resumesPerMonth: 50,
    jobParsingPerMonth: -1, // Unlimited
    interviewSessionsPerMonth: 0, // Not included in Pro
    autoApplyApprovalsPerMonth: 0, // Premium-only feature
    applicationsPerDay: -1,
    priority: 'normal',
    features: {
      pdfExport: true,
      multipleTemplates: true,
      premiumTemplates: false,
      customBranding: false,
      atsOptimization: true,
      keywordMatching: 'basic',
      applicationTracking: 'semi-auto',
      basicAnalytics: true,
      advancedAnalytics: false,
      extendedProfile: true,
      linkedinImport: false, // Premium-only feature
      multiLanguage: 'de-en',
      interviewCoach: false,
      autoApplyAgent: false,
      emailParsing: false,
      prioritySupport: false,
      noAds: true,
    },
  },
  PREMIUM: {
    coverLettersPerMonth: -1, // Unlimited
    resumesPerMonth: -1, // Unlimited
    jobParsingPerMonth: -1, // Unlimited
    interviewSessionsPerMonth: -1, // Unlimited
    autoApplyApprovalsPerMonth: 50, // Hard cap to keep Apify cost predictable
    applicationsPerDay: -1,
    priority: 'high',
    features: {
      pdfExport: true,
      multipleTemplates: true,
      premiumTemplates: true,
      customBranding: true,
      atsOptimization: true,
      keywordMatching: 'semantic',
      applicationTracking: 'auto',
      basicAnalytics: true,
      advancedAnalytics: true,
      extendedProfile: true,
      linkedinImport: true,
      multiLanguage: 'all',
      interviewCoach: true,
      autoApplyAgent: true,
      emailParsing: true,
      prioritySupport: true,
      noAds: true,
    },
  },
};

/**
 * Tier hierarchy for comparison
 * Higher number = higher tier
 */
const TIER_HIERARCHY: Record<SubscriptionTier, number> = {
  FREE: 0,
  PRO: 1,
  PREMIUM: 2,
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
   * Admin: set a user's subscription tier and (re)start a billing period.
   *
   * Idempotent — safe to call repeatedly. Used by `/admin/users/:email/tier`
   * and the seed/dev tooling. For paid downgrades the caller is responsible
   * for any Stripe-side cleanup; this method only mutates the local row.
   */
  async setUserTier(
    userId: string,
    tier: SubscriptionTier,
    options?: { periodMonths?: number },
  ) {
    const now = new Date();
    const periodEnd = new Date(now);
    if (options?.periodMonths && options.periodMonths > 0) {
      periodEnd.setMonth(periodEnd.getMonth() + options.periodMonths);
    } else {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    }

    const updated = await this.prisma.subscription.upsert({
      where: { userId },
      update: {
        tier,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
      },
      create: {
        userId,
        tier,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        usage: { create: { periodStart: now, periodEnd } },
      },
      include: { usage: true },
    });

    this.logger.log(`Admin: set tier=${tier} for user ${userId} (period ends ${periodEnd.toISOString()})`);
    return updated;
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
    action: 'application' | 'coverLetter' | 'resume' | 'jobParsing' | 'interview' | 'autoApply',
  ): Promise<CanPerformActionResult> {
    const subscription = await this.getOrCreateSubscription(userId);
    const limits = this.getTierLimits(subscription.tier);

    // Ensure usage period is current (monthly window)
    let usage = await this.ensureCurrentUsagePeriod(subscription.id);
    // Roll the rolling 24h daily window if needed
    usage = await this.ensureCurrentDailyWindow(usage);

    let used: number;
    let limit: number;
    let actionName: string;
    let isDaily = false;

    switch (action) {
      case 'application':
        used = usage.dailyApplicationsUsed;
        limit = limits.applicationsPerDay;
        actionName = 'Bewerbungen';
        isDaily = true;
        break;
      case 'coverLetter':
        used = usage.coverLettersGenerated;
        limit = limits.coverLettersPerMonth;
        actionName = 'KI-Anschreiben';
        break;
      case 'resume':
        used = usage.resumesGenerated;
        limit = limits.resumesPerMonth;
        actionName = 'KI-Lebensläufe';
        break;
      case 'jobParsing':
        used = usage.jobParsingUsed;
        limit = limits.jobParsingPerMonth;
        actionName = 'Job-Parses';
        break;
      case 'interview':
        used = usage.interviewSessionsUsed;
        limit = limits.interviewSessionsPerMonth;
        actionName = 'Interview-Sessions';
        break;
      case 'autoApply':
        used = usage.autoApplyApprovedUsed;
        limit = limits.autoApplyApprovalsPerMonth;
        actionName = 'Auto-Apply Bewerbungen';
        break;
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
      const window = isDaily ? 'tägliches' : 'monatliches';
      return {
        allowed: false,
        reason: `Du hast dein ${window} Limit von ${limit} ${actionName} erreicht. Bitte versuche es später erneut.`,
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
  async recordUsage(
    userId: string,
    action: 'application' | 'coverLetter' | 'resume' | 'jobParsing' | 'interview' | 'autoApply',
  ): Promise<void> {
    const subscription = await this.getOrCreateSubscription(userId);
    let usage = await this.ensureCurrentUsagePeriod(subscription.id);
    usage = await this.ensureCurrentDailyWindow(usage);

    const updateData: Record<string, { increment: number }> = {};

    switch (action) {
      case 'application':
        // One full "application generated" event — increments the daily
        // cost-protection counter only. Per-document monthly counters are
        // bumped separately by 'coverLetter' / 'resume' calls when those
        // sub-steps actually run.
        updateData.dailyApplicationsUsed = { increment: 1 };
        break;
      case 'coverLetter':
        updateData.coverLettersGenerated = { increment: 1 };
        updateData.applicationsUsed = { increment: 1 }; // Also increment combined counter
        break;
      case 'resume':
        updateData.resumesGenerated = { increment: 1 };
        updateData.applicationsUsed = { increment: 1 }; // Also increment combined counter
        break;
      case 'jobParsing':
        updateData.jobParsingUsed = { increment: 1 };
        break;
      case 'interview':
        updateData.interviewSessionsUsed = { increment: 1 };
        break;
      case 'autoApply':
        // One "approval" = one auto-apply suggestion the user said yes to.
        // Independent from the regular monthly cover-letter / resume quota:
        // when the resulting Application generates PDFs those counters are
        // also bumped via the normal pipeline.
        updateData.autoApplyApprovedUsed = { increment: 1 };
        break;
    }

    await this.prisma.subscriptionUsage.update({
      where: { id: usage.id },
      data: updateData,
    });

    this.logger.debug(`Recorded ${action} usage for user ${userId}`);
  }

  /**
   * Get current usage statistics for a user
   */
  async getUsageStats(userId: string) {
    const subscription = await this.getOrCreateSubscription(userId);
    let usage = await this.ensureCurrentUsagePeriod(subscription.id);
    usage = await this.ensureCurrentDailyWindow(usage);
    const limits = this.getTierLimits(subscription.tier);

    return {
      tier: subscription.tier,
      status: subscription.status,
      coverLetters: {
        used: usage.coverLettersGenerated,
        limit: limits.coverLettersPerMonth,
        remaining:
          limits.coverLettersPerMonth === -1
            ? -1
            : Math.max(0, limits.coverLettersPerMonth - usage.coverLettersGenerated),
      },
      resumes: {
        used: usage.resumesGenerated,
        limit: limits.resumesPerMonth,
        remaining:
          limits.resumesPerMonth === -1
            ? -1
            : Math.max(0, limits.resumesPerMonth - usage.resumesGenerated),
      },
      jobParsing: {
        used: usage.jobParsingUsed,
        limit: limits.jobParsingPerMonth,
        remaining:
          limits.jobParsingPerMonth === -1
            ? -1
            : Math.max(0, limits.jobParsingPerMonth - usage.jobParsingUsed),
      },
      interviewSessions: {
        used: usage.interviewSessionsUsed,
        limit: limits.interviewSessionsPerMonth,
        remaining:
          limits.interviewSessionsPerMonth === -1
            ? -1
            : Math.max(0, limits.interviewSessionsPerMonth - usage.interviewSessionsUsed),
      },
      // Daily application cap (rolling 24h window, cost protection)
      applicationsToday: {
        used: usage.dailyApplicationsUsed,
        limit: limits.applicationsPerDay,
        remaining:
          limits.applicationsPerDay === -1
            ? -1
            : Math.max(0, limits.applicationsPerDay - usage.dailyApplicationsUsed),
        windowStart: usage.dailyWindowStart,
      },
      // Combined applications (cover letters + resumes for legacy compatibility)
      applications: {
        used: usage.applicationsUsed,
        limit: -1, // Applications are tracked individually now
        remaining: -1,
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
    return !!limits.features[feature];
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
          coverLettersGenerated: 0,
          resumesGenerated: 0,
          jobParsingUsed: 0,
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
          coverLettersGenerated: 0,
          resumesGenerated: 0,
          jobParsingUsed: 0,
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

  /**
   * Roll the rolling 24-hour daily window. If the existing window is older
   * than 24 hours, reset the daily counter and stamp a fresh window start.
   * Returns the (possibly updated) usage row.
   */
  private async ensureCurrentDailyWindow(usage: SubscriptionUsage): Promise<SubscriptionUsage> {
    const ageMs = Date.now() - new Date(usage.dailyWindowStart).getTime();
    if (ageMs < 24 * 60 * 60 * 1000) {
      return usage;
    }
    return this.prisma.subscriptionUsage.update({
      where: { id: usage.id },
      data: {
        dailyApplicationsUsed: 0,
        dailyWindowStart: new Date(),
      },
    });
  }
}
