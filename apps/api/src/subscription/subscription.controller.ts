import { Controller, Get, Post, Body, Param, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TierGuard } from '../common/guards/tier.guard';
import { UsageLimitGuard } from '../common/guards/usage-limit.guard';
import { UsageInterceptor } from '../common/interceptors/usage.interceptor';
import {
  RequiresPro,
  RequiresPremium,
  CheckUsage,
  ProFeature,
  PremiumFeature,
} from '../common/decorators/tier.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { SubscriptionService, TIER_LIMITS } from './subscription.service';
import { CheckActionDto } from './dto/check-action.dto';

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
   * Get all available tiers with features (Public - for pricing page)
   * Useful for displaying upgrade options
   */
  @Get('tiers')
  @Public()
  @ApiOperation({ summary: 'Get all available tiers with features' })
  @ApiResponse({
    status: 200,
    description: 'Returns all subscription tiers with their limits, features, and pricing',
  })
  async getTiers() {
    return {
      tiers: [
        {
          id: 'FREE',
          name: 'Free',
          tagline: 'Smart Apply risikofrei testen',
          price: 0,
          priceDisplay: '0 €',
          priceInterval: 'Monat',
          features: [
            '3 Bewerbungen pro Monat',
            'ATS-Score für jede Bewerbung',
            'Übersichtliches Bewerbungstracking',
            'Keine Kreditkarte erforderlich',
          ],
          limits: this.subscriptionService.getTierLimits('FREE'),
        },
        {
          id: 'PRO',
          name: 'Pro',
          tagline: 'Bessere Bewerbungen, mehr Interviews',
          price: 999, // cents
          priceDisplay: '9,99 €',
          priceInterval: 'Monat',
          features: [
            'KI-generierte Lebensläufe & Anschreiben',
            'Mehrere professionelle Templates',
            'ATS-Optimierung & Keyword-Matching',
            'Bewerbungstracking mit Statusverlauf',
            'Analytics: ATS-Score, Keyword-Score, Match-Insights',
            'Zugang zur integrierten Jobsuche',
          ],
          limits: this.subscriptionService.getTierLimits('PRO'),
        },
        {
          id: 'PREMIUM',
          name: 'Premium',
          tagline: 'Deine Jobsuche läuft auf Autopilot',
          price: 1999, // cents
          priceDisplay: '19,99 €',
          priceInterval: 'Monat',
          recommended: true,
          badge: 'Beste Wahl für aktive Jobsuche',
          features: [
            'Alles aus Pro',
            'Auto-Apply Agent — bewirbt sich automatisch für dich',
            'Automatisches Tracking per E-Mail-Erkennung',
            'KI Interview-Coach für die Vorbereitung',
            'Erweiterte Analytics & Trends',
            'Priorisierte Generierung & Premium-Support',
          ],
          limits: this.subscriptionService.getTierLimits('PREMIUM'),
        },
      ],
    };
  }

  /**
   * Check if user can perform a specific action (GET - legacy)
   */
  @Get('can-perform/:action')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check if user can perform action (legacy)' })
  @ApiParam({ name: 'action', enum: ['coverLetter', 'resume', 'jobParsing', 'interview', 'autoApply'] })
  async canPerformActionGet(
    @CurrentUser('id') userId: string,
    @Param('action') action: 'coverLetter' | 'resume' | 'jobParsing' | 'interview' | 'autoApply',
  ) {
    return this.subscriptionService.canPerformAction(userId, action);
  }

  /**
   * Check if user can perform a specific action (POST - recommended)
   */
  @Post('check-action')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check if action is allowed' })
  @ApiResponse({
    status: 200,
    description: 'Returns whether the action is allowed and remaining quota',
  })
  async checkAction(@CurrentUser('id') userId: string, @Body() dto: CheckActionDto) {
    return this.subscriptionService.canPerformAction(userId, dto.action);
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
   * Test endpoint: Requires Pro tier
   */
  @Get('test/pro-only')
  @UseGuards(JwtAuthGuard, TierGuard)
  @RequiresPro()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Test: Pro only endpoint' })
  async testProOnly(@CurrentUser('id') userId: string) {
    const tier = await this.subscriptionService.getUserTier(userId);
    return {
      message: 'Du hast Zugriff auf Pro-Features! 🎉',
      yourTier: tier,
    };
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
      message: 'Du hast Zugriff auf Premium-Features! 🌟',
      yourTier: tier,
    };
  }

  /**
   * Test endpoint: Check cover letter usage limit
   */
  @Post('test/check-cover-letter-limit')
  @UseGuards(JwtAuthGuard, UsageLimitGuard)
  @UseInterceptors(UsageInterceptor)
  @CheckUsage('coverLetter')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Test: Check cover letter usage limit' })
  async testCoverLetterLimit(@CurrentUser('id') userId: string) {
    const stats = await this.subscriptionService.getUsageStats(userId);
    return {
      message: 'Du kannst ein Anschreiben erstellen!',
      coverLetters: stats.coverLetters,
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
   * Simulate recording cover letter usage
   */
  @Post('test/record-cover-letter')
  @UseGuards(JwtAuthGuard, UsageLimitGuard)
  @UseInterceptors(UsageInterceptor)
  @CheckUsage('coverLetter')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Test: Record cover letter usage' })
  async testRecordCoverLetter(@CurrentUser('id') userId: string) {
    await this.subscriptionService.recordUsage(userId, 'coverLetter');
    const stats = await this.subscriptionService.getUsageStats(userId);
    return {
      message: 'Anschreiben wurde gezählt!',
      coverLetters: stats.coverLetters,
    };
  }
}
