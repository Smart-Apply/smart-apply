import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { FeatureGuard } from '../common/guards/feature.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequiresFeature } from '../common/decorators/tier.decorator';

import { AutoApplyService } from './auto-apply.service';
import { AutoApplyCron } from './auto-apply.cron';
import {
  ApproveSuggestionResponseDto,
  AutoApplyConfigDto,
  AutoApplySuggestionDto,
  UpsertAutoApplyConfigDto,
} from './auto-apply.dto';

/**
 * Auto-Apply Agent (Premium feature).
 *
 * All endpoints gated by JwtAuthGuard + FeatureGuard with
 * `@RequiresFeature('autoApplyAgent')`. The cron worker (`AutoApplyCron`)
 * lives in this same module and is exposed once via `POST /run-now` for
 * manual triggering (rate-limited).
 */
@ApiTags('Auto-Apply')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, FeatureGuard)
@RequiresFeature('autoApplyAgent')
@Controller('auto-apply')
export class AutoApplyController {
  private readonly logger = new Logger(AutoApplyController.name);

  constructor(
    private readonly service: AutoApplyService,
    private readonly cron: AutoApplyCron,
  ) {}

  // ─── Config ─────────────────────────────────────────────────────────

  @Get('config')
  @ApiOperation({ summary: 'Get current Auto-Apply configuration' })
  @ApiResponse({ status: 200, type: () => AutoApplyConfigDto })
  async getConfig(@CurrentUser('id') userId: string): Promise<AutoApplyConfigDto | null> {
    return this.service.getConfig(userId);
  }

  @Put('config')
  @ApiOperation({ summary: 'Create or update Auto-Apply configuration' })
  @ApiResponse({ status: 200, type: () => AutoApplyConfigDto })
  async upsertConfig(
    @CurrentUser('id') userId: string,
    @Body() dto: UpsertAutoApplyConfigDto,
  ): Promise<AutoApplyConfigDto> {
    return this.service.upsertConfig(userId, dto);
  }

  @Post('config/pause')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pause Auto-Apply (no further cron runs)' })
  async pause(@CurrentUser('id') userId: string): Promise<AutoApplyConfigDto> {
    return this.service.setActive(userId, false);
  }

  @Post('config/resume')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resume Auto-Apply' })
  async resume(@CurrentUser('id') userId: string): Promise<AutoApplyConfigDto> {
    return this.service.setActive(userId, true);
  }

  @Delete('config')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete Auto-Apply configuration' })
  async deleteConfig(@CurrentUser('id') userId: string): Promise<void> {
    return this.service.deleteConfig(userId);
  }

  /**
   * Manual "run now" — handy for users wanting to refresh the inbox or
   * for testing. Throttled to 1 call per hour per user so it can't be
   * used to bypass the cron-spread cost-protection.
   *
   * Fire-and-forget: the LinkedIn search via Apify can take 60–240s, which
   * exceeds Fly's edge timeout (~60s) and surfaces to the browser as 408.
   * We dispatch the work asynchronously and return 202 immediately; the
   * client polls `/auto-apply/suggestions` to surface new results.
   */
  @Post('config/run-now')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 1, ttl: 3_600_000 } })
  @ApiOperation({ summary: 'Manually trigger one recommendation run (1/hour, runs in background)' })
  @ApiResponse({ status: 202, description: 'Run dispatched (background)' })
  @ApiResponse({ status: 429, description: 'Too many manual triggers' })
  runNow(@CurrentUser('id') userId: string): { ok: boolean; dispatched: boolean } {
    // Intentionally not awaited — see method docblock for why.
    void this.cron.runForUser(userId).catch((err) => {
      this.logger.error(
        `Background run-now failed for user ${userId}: ${(err as Error).message}`,
        (err as Error).stack,
      );
    });
    return { ok: true, dispatched: true };
  }

  // ─── Suggestions ────────────────────────────────────────────────────

  @Get('suggestions')
  @ApiOperation({ summary: 'List suggestions in the inbox (paginated)' })
  async listSuggestions(
    @CurrentUser('id') userId: string,
    @Query('status') status?: 'PENDING' | 'APPROVED' | 'SKIPPED' | 'BLOCKED' | 'EXPIRED',
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
  ): Promise<{ items: AutoApplySuggestionDto[]; total: number; page: number; pageSize: number }> {
    return this.service.listSuggestions(userId, {
      status,
      page: Number(page),
      pageSize: Number(pageSize),
    });
  }

  @Post('suggestions/:id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve a suggestion → generate Application (Premium quota)' })
  @ApiResponse({ status: 200, type: () => ApproveSuggestionResponseDto })
  @ApiResponse({ status: 403, description: 'Monthly auto-apply quota exhausted' })
  async approve(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ): Promise<ApproveSuggestionResponseDto> {
    return this.service.approve(userId, id);
  }

  @Post('suggestions/:id/skip')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Dismiss a suggestion' })
  async skip(@CurrentUser('id') userId: string, @Param('id') id: string): Promise<void> {
    return this.service.skip(userId, id);
  }

  @Post('suggestions/:id/block')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Block a company (also auto-skips other pending suggestions from it)' })
  async block(@CurrentUser('id') userId: string, @Param('id') id: string): Promise<void> {
    return this.service.block(userId, id);
  }
}
