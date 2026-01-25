import { Controller, Get, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
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
import { SubscriptionService } from './subscription.service';

@ApiTags('Subscription')
@Controller('subscription')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  /**
   * Get current user's subscription status and usage
   */
  @Get('status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get subscription status and usage' })
  async getStatus(@CurrentUser('id') userId: string) {
    return this.subscriptionService.getUsageStats(userId);
  }

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
