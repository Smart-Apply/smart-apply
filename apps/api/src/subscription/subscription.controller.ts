import { Controller, Get, Post, Param, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TierGuard } from '../common/guards/tier.guard';
import { UsageLimitGuard } from '../common/guards/usage-limit.guard';
import { UsageInterceptor } from '../common/interceptors/usage.interceptor';
import {
  RequiresPremium,
  RequiresPremiumPlus,
  CheckUsage,
  PremiumFeature,
} from '../common/decorators/tier.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SubscriptionService, TIER_LIMITS } from './subscription.service';

@ApiTags('Subscription')
@Controller('subscription')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  // ============================================
  // Production API Endpoints
  // ============================================

  /**
   * Get current user's complete subscription information
   * Includes tier, status, usage, and features
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current subscription' })
  @ApiResponse({
    status: 200,
    description:
      'Returns current subscription with tier, status, usage stats, and available features',
  })
  async getSubscription(@CurrentUser('id') userId: string) {
    return this.subscriptionService.getUsageStats(userId);
  }

  /**
   * Get current usage statistics
   * Shows how many applications/interviews used and remaining
   */
  @Get('usage')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get usage statistics' })
  @ApiResponse({
    status: 200,
    description: 'Returns usage statistics for current billing period',
  })
  async getUsage(@CurrentUser('id') userId: string) {
    const stats = await this.subscriptionService.getUsageStats(userId);
    return {
      applications: stats.applications,
      interviewSessions: stats.interviewSessions,
      periodStart: stats.periodStart,
      periodEnd: stats.periodEnd,
    };
  }

  /**
   * Get limits for current tier
   * Shows limits for applications, interview sessions, and available features
   */
  @Get('limits')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current tier limits' })
  @ApiResponse({
    status: 200,
    description: 'Returns limits for the current subscription tier',
  })
  async getLimits(@CurrentUser('id') userId: string) {
    const tier = await this.subscriptionService.getUserTier(userId);
    const limits = this.subscriptionService.getTierLimits(tier);
    return {
      tier,
      limits,
    };
  }

  /**
   * Get all available tiers and their limits
   * Useful for displaying upgrade options
   */
  @Get('tiers')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all available tiers and limits' })
  @ApiResponse({
    status: 200,
    description: 'Returns all subscription tiers with their limits and features',
  })
  async getAllTiers(@CurrentUser('id') userId: string) {
    const currentTier = await this.subscriptionService.getUserTier(userId);
    return {
      currentTier,
      tiers: TIER_LIMITS,
    };
  }

  /**
   * Check if user can perform a specific action
   */
  @Get('can-perform/:action')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check if user can perform action' })
  @ApiParam({ name: 'action', enum: ['application', 'interview'] })
  async canPerformAction(
    @CurrentUser('id') userId: string,
    @Param('action') action: 'application' | 'interview',
  ) {
    return this.subscriptionService.canPerformAction(userId, action);
  }

  // ============================================
  // Legacy/Alias Endpoints (for backward compatibility)
  // ============================================

  /**
   * Get current user's subscription status and usage (alias for GET /)
   */
  @Get('status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get subscription status and usage (alias)' })
  async getStatus(@CurrentUser('id') userId: string) {
    return this.subscriptionService.getUsageStats(userId);
  }

  // ============================================
  // Test Endpoints (for development/testing)
  // ============================================

  /**
   * Test endpoint: Requires Premium tier
   */
  @Get('test/premium-only')
  @UseGuards(JwtAuthGuard, TierGuard)
  @RequiresPremium()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Test: Premium only endpoint' })
  async testPremiumOnly(@CurrentUser('id') userId: string) {
    const tier = await this.subscriptionService.getUserTier(userId);
    return {
      message: 'Du hast Zugriff auf Premium-Features! 🎉',
      yourTier: tier,
    };
  }

  /**
   * Test endpoint: Requires Premium Plus tier
   */
  @Get('test/premium-plus-only')
  @UseGuards(JwtAuthGuard, TierGuard)
  @RequiresPremiumPlus()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Test: Premium Plus only endpoint' })
  async testPremiumPlusOnly(@CurrentUser('id') userId: string) {
    const tier = await this.subscriptionService.getUserTier(userId);
    return {
      message: 'Du hast Zugriff auf Premium Plus-Features! 🌟',
      yourTier: tier,
    };
  }

  /**
   * Test endpoint: Check application usage limit
   */
  @Post('test/check-application-limit')
  @UseGuards(JwtAuthGuard, UsageLimitGuard)
  @UseInterceptors(UsageInterceptor)
  @CheckUsage('application')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Test: Check application usage limit' })
  async testApplicationLimit(@CurrentUser('id') userId: string) {
    // Note: This doesn't actually record usage, just checks if allowed
    const stats = await this.subscriptionService.getUsageStats(userId);
    return {
      message: 'Du kannst eine Bewerbung erstellen!',
      applications: stats.applications,
    };
  }

  /**
   * Test endpoint: Check interview usage limit (Premium only)
   */
  @Post('test/check-interview-limit')
  @UseGuards(JwtAuthGuard, TierGuard, UsageLimitGuard)
  @UseInterceptors(UsageInterceptor)
  @PremiumFeature('interview')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Test: Check interview usage limit (Premium)' })
  async testInterviewLimit(@CurrentUser('id') userId: string) {
    const stats = await this.subscriptionService.getUsageStats(userId);
    return {
      message: 'Du kannst eine Interview-Session starten!',
      interviewSessions: stats.interviewSessions,
    };
  }

  /**
   * Simulate recording application usage
   */
  @Post('test/record-application')
  @UseGuards(JwtAuthGuard, UsageLimitGuard)
  @UseInterceptors(UsageInterceptor)
  @CheckUsage('application')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Test: Record application usage' })
  async testRecordApplication(@CurrentUser('id') userId: string) {
    await this.subscriptionService.recordUsage(userId, 'application');
    const stats = await this.subscriptionService.getUsageStats(userId);
    return {
      message: 'Bewerbung wurde gezählt!',
      applications: stats.applications,
    };
  }
}
