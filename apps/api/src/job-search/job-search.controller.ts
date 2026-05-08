import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SubscriptionService } from '../subscription/subscription.service';
import { SubscriptionTier } from '../generated/prisma/client';
import { JobPostingResponseDto } from '../job-postings/dto/job-posting-response.dto';

import { JobSearchService } from './job-search.service';
import { UnifiedJobSearchRequestDto } from './dto/unified-job-search-request.dto';
import {
  ImportUnifiedJobDto,
  UnifiedJobSearchResponseDto,
} from './dto/unified-job.dto';

interface AuthenticatedUser {
  id: string;
  email: string;
}

/**
 * Unified job-search endpoints — fan out to all configured providers
 * (LinkedIn via Apify, Arbeitnow public API, …) and return a merged,
 * deduplicated result list.
 *
 * Coexists with the legacy `/linkedin-jobs/*` endpoints (kept for
 * backward compatibility with the current frontend); new clients should
 * prefer this module.
 *
 * Auth: every endpoint requires JWT. Premium gating happens per-source
 * inside `JobSearchService` so FREE users still get Arbeitnow results.
 */
@ApiTags('Job Search')
@ApiBearerAuth()
@Controller('job-search')
@UseGuards(JwtAuthGuard)
export class JobSearchController {
  private readonly logger = new Logger(JobSearchController.name);

  constructor(
    private readonly service: JobSearchService,
    private readonly subscriptions: SubscriptionService,
  ) {}

  /**
   * List configured providers + per-tier availability. The frontend
   * uses this to render the "Search in:" picker so it can grey out
   * sources the current user can't actually use.
   */
  @Get('sources')
  @ApiOperation({ summary: 'List configured job-search sources for the current user' })
  async sources(@CurrentUser() user: AuthenticatedUser) {
    const isPremium = await this.subscriptions.hasTier(user.id, SubscriptionTier.PREMIUM);
    return { sources: this.service.listProviders({ isPremium }) };
  }

  /**
   * Run a unified search. Throttled to 30 calls per hour per user —
   * covers the worst-case "Apify on every keystroke" misuse pattern
   * while leaving plenty of headroom for legitimate exploration.
   *
   * Per-source Apify cost is bounded a second time inside
   * `LinkedInJobsService.search` (10 calls/hour limit on the legacy
   * endpoint), so adding this endpoint can't blow the cost ceiling.
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 3_600_000 } })
  @ApiOperation({
    summary: 'Search jobs across all configured sources',
    description:
      'Fan-out search across LinkedIn (Premium) and Arbeitnow (free). Pass `sources` to restrict to specific providers.',
  })
  @ApiBody({ type: UnifiedJobSearchRequestDto })
  @ApiResponse({ status: 200, type: UnifiedJobSearchResponseDto })
  @ApiResponse({ status: 429, description: 'Too many search requests' })
  @ApiResponse({ status: 503, description: 'No requested source is available' })
  async search(
    @CurrentUser() user: AuthenticatedUser,
    @Body() request: UnifiedJobSearchRequestDto,
  ): Promise<UnifiedJobSearchResponseDto> {
    const isPremium = await this.subscriptions.hasTier(user.id, SubscriptionTier.PREMIUM);
    this.logger.log(
      `User ${user.id} search keywords="${request.keywords ?? ''}" sources=${
        request.sources?.join(',') ?? 'all'
      } premium=${isPremium}`,
    );

    const { results, sources } = await this.service.search(request, { isPremium });

    return {
      results,
      totalCount: results.length,
      sources,
      searchedAt: new Date().toISOString(),
    };
  }

  /**
   * Persist a search result as a JobPosting via its originating
   * provider so the application wizard can consume it. Throttled to
   * 60/hour to cover bulk-import workflows without inviting abuse.
   */
  @Post('import')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 60, ttl: 3_600_000 } })
  @ApiOperation({ summary: 'Import a search result as a JobPosting' })
  @ApiBody({ type: ImportUnifiedJobDto })
  @ApiResponse({ status: 201, description: 'Job posting created' })
  @ApiResponse({ status: 403, description: 'Source requires Premium' })
  async import(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ImportUnifiedJobDto,
  ): Promise<JobPostingResponseDto> {
    const isPremium = await this.subscriptions.hasTier(user.id, SubscriptionTier.PREMIUM);
    this.logger.log(
      `User ${user.id} importing source=${dto.job.source} externalId=${dto.job.externalId}`,
    );
    return this.service.importJob(user.id, dto.job, { isPremium });
  }
}
