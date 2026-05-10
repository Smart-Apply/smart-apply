import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { SubscriptionTier } from '../generated/prisma/client';
import { AdminGuard } from './admin.guard';

class SetTierDto {
  @IsIn(['FREE', 'PREMIUM', 'PREMIUM_PLUS'])
  tier!: SubscriptionTier;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(120)
  periodMonths?: number;
}

/**
 * Admin endpoints — gated by `ADMIN_EMAILS` env var (case-insensitive
 * allow-list). When `ADMIN_EMAILS` is empty, every route here returns 403.
 *
 * These endpoints are intentionally narrow: they exist to replace one-off
 * scripts that previously had to be `flyctl ssh`'d into the running
 * container. Nothing here is exposed to regular users.
 */
@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionService,
  ) {}

  /**
   * Look up users by partial email match (case-insensitive). Useful before
   * calling the tier-change endpoint to confirm casing.
   */
  @Get('users')
  @ApiOperation({ summary: 'Search users by partial email (admin only)' })
  async findUsers(@Query('email') email?: string) {
    if (!email || email.length < 2) {
      throw new BadRequestException('Provide ?email=<at-least-2-chars>');
    }
    const users = await this.prisma.user.findMany({
      where: { email: { contains: email, mode: 'insensitive' } },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        createdAt: true,
        subscription: { select: { tier: true, status: true, currentPeriodEnd: true } },
      },
      take: 20,
      orderBy: { createdAt: 'desc' },
    });
    return { count: users.length, users };
  }

  /**
   * Change a user's subscription tier and reset the billing period.
   *
   * Idempotent. The :email path param is matched case-insensitively. Returns
   * the updated subscription including the (possibly newly-created) usage
   * row.
   *
   * Example:
   *   POST /api/v1/admin/users/foo@example.com/tier
   *   Body: { "tier": "PREMIUM" }
   *   Body: { "tier": "PREMIUM", "periodMonths": 6 }
   */
  @Post('users/:email/tier')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Set a user's subscription tier (admin only)" })
  async setUserTier(
    @Param('email') email: string,
    @Body() body: SetTierDto,
    @CurrentUser('email') actorEmail: string,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true, email: true },
    });

    if (!user) {
      throw new NotFoundException(`User not found: ${email}`);
    }

    const updated = await this.subscriptions.setUserTier(user.id, body.tier, {
      periodMonths: body.periodMonths,
    });

    this.logger.log(
      `Admin ${actorEmail} set tier=${body.tier} for ${user.email} (id=${user.id})`,
    );

    return {
      user: { id: user.id, email: user.email },
      subscription: {
        tier: updated.tier,
        status: updated.status,
        currentPeriodStart: updated.currentPeriodStart,
        currentPeriodEnd: updated.currentPeriodEnd,
      },
    };
  }

  /**
   * Permanently delete a user account by email (admin override \u2014 no
   * password confirmation required).
   *
   * Use case: an OAuth-only user (e.g. "Sign in with Google") asks support
   * to delete their account but cannot complete the self-service flow
   * because they never set a password. Once the frontend OAuth-aware
   * delete dialog ships, this endpoint stays as the support escape hatch.
   *
   * Cascade: Prisma `onDelete: Cascade` cleans up Profile, Applications,
   * JobPostings, Sessions, RefreshTokens, UserPreferences, OAuthProviders,
   * MailboxConnections, etc. Stored PDF files in R2/disk are NOT deleted
   * here \u2014 same trade-off as `AuthService.deleteAccount`. A separate
   * cleanup job handles orphaned blobs.
   *
   * Idempotent-ish: returns 404 if the user is already gone.
   *
   * Example:
   *   DELETE /api/v1/admin/users/foo@example.com
   */
  @Delete('users/:email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Permanently delete a user account by email (admin only)' })
  async deleteUser(
    @Param('email') email: string,
    @CurrentUser('email') actorEmail: string,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true, email: true, provider: true },
    });

    if (!user) {
      throw new NotFoundException(`User not found: ${email}`);
    }

    await this.prisma.user.delete({ where: { id: user.id } });

    this.logger.warn(
      `Admin ${actorEmail} permanently deleted user ${user.email} (id=${user.id}, provider=${user.provider ?? 'local'})`,
    );

    return {
      deleted: true,
      user: { id: user.id, email: user.email, provider: user.provider },
    };
  }
}
