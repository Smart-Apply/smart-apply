import {
  Body,
  Controller,
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
import { TierGuard } from '../common/guards/tier.guard';
import { FeatureGuard } from '../common/guards/feature.guard';
import { UsageLimitGuard } from '../common/guards/usage-limit.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  CheckUsage,
  RequiresFeature,
  RequiresPremium,
} from '../common/decorators/tier.decorator';

import { LinkedInJobsService } from './linkedin-jobs.service';
import { SearchLinkedInJobsDto } from './dto/search-linkedin-jobs.dto';
import {
  ImportLinkedInJobDto,
  LinkedInJobSearchResponseDto,
} from './dto/linkedin-job.dto';
import { JobPostingResponseDto } from '../job-postings/dto/job-posting-response.dto';

interface AuthenticatedUser {
  id: string;
  email: string;
}

@ApiTags('LinkedIn Jobs')
@ApiBearerAuth()
@Controller('linkedin-jobs')
@UseGuards(JwtAuthGuard)
export class LinkedInJobsController {
  private readonly logger = new Logger(LinkedInJobsController.name);

  constructor(private readonly service: LinkedInJobsService) {}

  /**
   * Search LinkedIn jobs (Premium feature).
   * Throttled to 10/hour per user — Apify calls cost ~$0.01–0.05 each.
   */
  @Post('search')
  @UseGuards(TierGuard, FeatureGuard, UsageLimitGuard)
  @RequiresPremium()
  @RequiresFeature('linkedinImport')
  @CheckUsage('jobParsing')
  @Throttle({ default: { limit: 10, ttl: 3_600_000 } })
  @ApiOperation({
    summary: 'Search LinkedIn job postings (Premium)',
    description:
      'Runs the configured Apify LinkedIn scraper with the provided filters. Counts against jobParsing quota.',
  })
  @ApiBody({ type: SearchLinkedInJobsDto })
  @ApiResponse({ status: 200, type: LinkedInJobSearchResponseDto })
  @ApiResponse({ status: 403, description: 'Premium subscription required' })
  @ApiResponse({ status: 429, description: 'Too many search requests' })
  @ApiResponse({ status: 503, description: 'APIFY_TOKEN not configured' })
  @HttpCode(HttpStatus.OK)
  async search(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SearchLinkedInJobsDto,
  ): Promise<LinkedInJobSearchResponseDto> {
    this.logger.log(
      `User ${user.id} searching LinkedIn jobs keywords="${dto.keywords ?? ''}" location="${dto.location ?? ''}"`,
    );
    return this.service.search(dto);
  }

  /**
   * Import a LinkedIn job result into the user's job postings.
   * Returns the freshly created JobPosting so the frontend can route the
   * user straight into the application wizard.
   */
  @Post('import')
  @UseGuards(TierGuard, FeatureGuard)
  @RequiresPremium()
  @RequiresFeature('linkedinImport')
  @Throttle({ default: { limit: 60, ttl: 3_600_000 } })
  @ApiOperation({
    summary: 'Import a LinkedIn job result as a JobPosting (Premium)',
    description:
      'Persists the supplied LinkedIn search result as a JobPosting that the application wizard can consume.',
  })
  @ApiBody({ type: ImportLinkedInJobDto })
  @ApiResponse({ status: 201, description: 'Job posting created' })
  @ApiResponse({ status: 403, description: 'Premium subscription required' })
  @HttpCode(HttpStatus.CREATED)
  async import(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ImportLinkedInJobDto,
  ): Promise<JobPostingResponseDto> {
    this.logger.log(
      `User ${user.id} importing LinkedIn job id=${dto.job.id} title="${dto.job.title}"`,
    );
    return this.service.importJob(user.id, dto.job);
  }
}
