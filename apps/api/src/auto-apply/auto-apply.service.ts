import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CronExpressionParser } from 'cron-parser';

import { PrismaService } from '../prisma/prisma.service';
import { ApplicationsService } from '../applications/applications.service';
import { LinkedInJobsService } from '../linkedin-jobs/linkedin-jobs.service';
import { SubscriptionService } from '../subscription/subscription.service';
import {
  ApproveSuggestionResponseDto,
  AutoApplyConfigDto,
  AutoApplySuggestionDto,
  UpsertAutoApplyConfigDto,
} from './auto-apply.dto';
import { Prisma } from '../generated/prisma/client';

/**
 * Auto-Apply core service.
 *
 * Owns CRUD on `AutoApplyConfig` + `AutoApplySuggestion` and the
 * approve / skip / block decision flow. The recommender cron lives in
 * `auto-apply.cron.ts` and only delegates to `runConfigOnce()`.
 */
@Injectable()
export class AutoApplyService {
  private readonly logger = new Logger(AutoApplyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly applications: ApplicationsService,
    private readonly linkedinJobs: LinkedInJobsService,
    private readonly subscription: SubscriptionService,
  ) {}

  // ─── Config ─────────────────────────────────────────────────────────

  async getConfig(userId: string): Promise<AutoApplyConfigDto | null> {
    const config = await this.prisma.autoApplyConfig.findUnique({
      where: { userId },
    });
    return config ? this.toConfigDto(config) : null;
  }

  async upsertConfig(
    userId: string,
    dto: UpsertAutoApplyConfigDto,
  ): Promise<AutoApplyConfigDto> {
    const cronSchedule = dto.cronSchedule ?? '0 9 * * *';
    const nextRunAt = this.computeNextRunAt(cronSchedule, new Date());

    const config = await this.prisma.autoApplyConfig.upsert({
      where: { userId },
      create: {
        userId,
        isActive: dto.isActive ?? true,
        searchFilters: dto.searchFilters as unknown as Prisma.InputJsonValue,
        maxSuggestionsPerDay: dto.maxSuggestionsPerDay ?? 5,
        minAtsScore: dto.minAtsScore ?? null,
        requiredKeywords: dto.requiredKeywords ?? [],
        blockedCompanies: dto.blockedCompanies ?? [],
        cronSchedule,
        digestEnabled: dto.digestEnabled ?? true,
        cvTemplateId: dto.cvTemplateId ?? null,
        clTemplateId: dto.clTemplateId ?? null,
        generateCoverLetter: dto.generateCoverLetter ?? true,
        nextRunAt,
      },
      update: {
        isActive: dto.isActive ?? true,
        searchFilters: dto.searchFilters as unknown as Prisma.InputJsonValue,
        maxSuggestionsPerDay: dto.maxSuggestionsPerDay ?? 5,
        minAtsScore: dto.minAtsScore ?? null,
        requiredKeywords: dto.requiredKeywords ?? [],
        blockedCompanies: dto.blockedCompanies ?? [],
        cronSchedule,
        digestEnabled: dto.digestEnabled ?? true,
        // Use ?? so an explicit `null` from the client clears the override
        // back to "backend auto-pick" without needing a second endpoint.
        cvTemplateId: dto.cvTemplateId ?? null,
        clTemplateId: dto.clTemplateId ?? null,
        generateCoverLetter: dto.generateCoverLetter ?? true,
        nextRunAt,
      },
    });

    this.logger.log(`Auto-apply config ${config.id} upserted for user ${userId} (active=${config.isActive})`);
    return this.toConfigDto(config);
  }

  async setActive(userId: string, isActive: boolean): Promise<AutoApplyConfigDto> {
    const existing = await this.prisma.autoApplyConfig.findUnique({ where: { userId } });
    if (!existing) {
      throw new NotFoundException('Keine Auto-Apply-Konfiguration gefunden.');
    }
    const config = await this.prisma.autoApplyConfig.update({
      where: { userId },
      data: {
        isActive,
        // When activating, schedule the next run from now; when pausing,
        // clear it so the cron query skips this row entirely.
        nextRunAt: isActive ? this.computeNextRunAt(existing.cronSchedule, new Date()) : null,
      },
    });
    return this.toConfigDto(config);
  }

  async deleteConfig(userId: string): Promise<void> {
    const existing = await this.prisma.autoApplyConfig.findUnique({ where: { userId } });
    if (!existing) return; // idempotent
    await this.prisma.autoApplyConfig.delete({ where: { userId } });
    this.logger.log(`Auto-apply config deleted for user ${userId}`);
  }

  // ─── Suggestions inbox ───────────────────────────────────────────────

  async listSuggestions(
    userId: string,
    opts: { status?: 'PENDING' | 'APPROVED' | 'SKIPPED' | 'BLOCKED' | 'EXPIRED'; page?: number; pageSize?: number },
  ): Promise<{ items: AutoApplySuggestionDto[]; total: number; page: number; pageSize: number }> {
    const page = Math.max(opts.page ?? 1, 1);
    const pageSize = Math.min(Math.max(opts.pageSize ?? 20, 1), 100);

    const where: Prisma.AutoApplySuggestionWhereInput = {
      userId,
      ...(opts.status ? { status: opts.status } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.autoApplySuggestion.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.autoApplySuggestion.count({ where }),
    ]);

    return {
      items: items.map((s) => this.toSuggestionDto(s)),
      total,
      page,
      pageSize,
    };
  }

  // ─── Decisions ──────────────────────────────────────────────────────

  /**
   * Approve a suggestion → materialise it as a JobPosting + Application,
   * counting it against the monthly autoApply quota.
   *
   * Routes through `applications.createWithGeneration()` (NOT plain
   * `create()`) so the user actually gets a finished, ATS-scored
   * application — the original `create()` only inserts a PENDING row
   * and skips the LLM/ATS pipeline, which is why every approved
   * suggestion used to come out with ATS=0%.
   *
   * Honors the user's per-config preferences:
   *   - `cvTemplateId` / `clTemplateId` → passed through to template resolver
   *     (still language-resolved; null = backend auto-pick)
   *   - `generateCoverLetter` → false skips the cover-letter half of the
   *     pipeline so the user gets a resume-only application
   *
   * Note: the resulting Application's PDF generation goes through the
   * regular pipeline and bumps the standard cover-letter / resume monthly
   * counters too. The autoApply counter is purely a Premium cost-cap on
   * "how many auto-apply suggestions can a user approve per month".
   */
  async approve(userId: string, suggestionId: string): Promise<ApproveSuggestionResponseDto> {
    const suggestion = await this.prisma.autoApplySuggestion.findFirst({
      where: { id: suggestionId, userId },
    });

    if (!suggestion) {
      throw new NotFoundException('Vorschlag nicht gefunden.');
    }

    if (suggestion.status !== 'PENDING') {
      throw new BadRequestException('Dieser Vorschlag wurde bereits bearbeitet.');
    }

    // Quota check (PREMIUM-only feature; FREE/PRO get 0 here)
    const quota = await this.subscription.canPerformAction(userId, 'autoApply');
    if (!quota.allowed) {
      throw new ForbiddenException(quota.reason ?? 'Auto-Apply Limit erreicht.');
    }

    // Pull the user's template + cover-letter preferences. Always present
    // when a suggestion exists, but defend against a manually deleted
    // config row by falling back to "auto-pick everything".
    const config = await this.prisma.autoApplyConfig.findUnique({
      where: { userId },
      select: {
        cvTemplateId: true,
        clTemplateId: true,
        generateCoverLetter: true,
      },
    });

    // Materialise as JobPosting if we haven't yet
    let jobPostingId = suggestion.jobPostingId ?? undefined;
    if (!jobPostingId) {
      const jobPosting = await this.linkedinJobs.importJob(userId, {
        id: suggestion.externalJobId,
        title: suggestion.jobTitle,
        company: suggestion.company,
        location: suggestion.location ?? undefined,
        url: suggestion.jobUrl,
      });
      jobPostingId = jobPosting.id;
    }

    // Generate application via the FULL pipeline (LLM + ATS + PDF), not
    // the bare `create()`. This is the fix for the ATS=0% bug.
    const application = await this.applications.createWithGeneration(userId, {
      jobPostingId,
      resumeTemplateId: config?.cvTemplateId ?? undefined,
      coverLetterTemplateId: config?.clTemplateId ?? undefined,
      generateCoverLetter: config?.generateCoverLetter ?? true,
    });

    // Mark suggestion as approved + record usage
    await this.prisma.$transaction([
      this.prisma.autoApplySuggestion.update({
        where: { id: suggestion.id },
        data: {
          status: 'APPROVED',
          decidedAt: new Date(),
          jobPostingId,
          applicationId: application.id,
        },
      }),
    ]);

    await this.subscription.recordUsage(userId, 'autoApply');

    this.logger.log(
      `User ${userId} approved suggestion ${suggestion.id} → application ${application.id}`,
    );

    return { applicationId: application.id };
  }

  async skip(userId: string, suggestionId: string): Promise<void> {
    await this.transitionSuggestion(userId, suggestionId, 'SKIPPED');
  }

  /**
   * Block company → mark suggestion BLOCKED and add company to user's blocklist
   * so future cron runs skip it entirely.
   */
  async block(userId: string, suggestionId: string): Promise<void> {
    const suggestion = await this.prisma.autoApplySuggestion.findFirst({
      where: { id: suggestionId, userId },
    });
    if (!suggestion) throw new NotFoundException('Vorschlag nicht gefunden.');
    if (suggestion.status !== 'PENDING') {
      throw new BadRequestException('Dieser Vorschlag wurde bereits bearbeitet.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.autoApplySuggestion.update({
        where: { id: suggestion.id },
        data: { status: 'BLOCKED', decidedAt: new Date() },
      });
      // Add company to the user's blocklist (idempotent — Postgres array ops)
      const config = await tx.autoApplyConfig.findUnique({ where: { userId } });
      if (config && !config.blockedCompanies.includes(suggestion.company)) {
        await tx.autoApplyConfig.update({
          where: { userId },
          data: { blockedCompanies: { push: suggestion.company } },
        });
      }
      // Also auto-skip any other pending suggestions from the same company
      await tx.autoApplySuggestion.updateMany({
        where: { userId, company: suggestion.company, status: 'PENDING' },
        data: { status: 'BLOCKED', decidedAt: new Date() },
      });
    });

    this.logger.log(`User ${userId} blocked company "${suggestion.company}"`);
  }

  // ─── Helpers ───────────────────────────────────────────────────────

  private async transitionSuggestion(
    userId: string,
    suggestionId: string,
    status: 'SKIPPED',
  ): Promise<void> {
    const suggestion = await this.prisma.autoApplySuggestion.findFirst({
      where: { id: suggestionId, userId },
    });
    if (!suggestion) throw new NotFoundException('Vorschlag nicht gefunden.');
    if (suggestion.status !== 'PENDING') {
      throw new BadRequestException('Dieser Vorschlag wurde bereits bearbeitet.');
    }
    await this.prisma.autoApplySuggestion.update({
      where: { id: suggestion.id },
      data: { status, decidedAt: new Date() },
    });
  }

  /**
   * Compute the next fire time for a cron expression. Returns null if the
   * expression is malformed (defensive — DTO validation should catch this).
   */
  computeNextRunAt(cronExpression: string, from: Date): Date | null {
    try {
      const interval = CronExpressionParser.parse(cronExpression, { currentDate: from });
      return interval.next().toDate();
    } catch (err) {
      this.logger.warn(`Invalid cron expression "${cronExpression}": ${(err as Error).message}`);
      return null;
    }
  }

  // ─── DTO mappers ────────────────────────────────────────────────────

  private toConfigDto(c: {
    id: string;
    isActive: boolean;
    searchFilters: Prisma.JsonValue;
    maxSuggestionsPerDay: number;
    minAtsScore: number | null;
    requiredKeywords: string[];
    blockedCompanies: string[];
    cronSchedule: string;
    digestEnabled: boolean;
    cvTemplateId: string | null;
    clTemplateId: string | null;
    generateCoverLetter: boolean;
    lastRunAt: Date | null;
    nextRunAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): AutoApplyConfigDto {
    return {
      id: c.id,
      isActive: c.isActive,
      searchFilters: (c.searchFilters as Record<string, unknown>) ?? {},
      maxSuggestionsPerDay: c.maxSuggestionsPerDay,
      minAtsScore: c.minAtsScore ?? undefined,
      requiredKeywords: c.requiredKeywords,
      blockedCompanies: c.blockedCompanies,
      cronSchedule: c.cronSchedule,
      digestEnabled: c.digestEnabled,
      cvTemplateId: c.cvTemplateId ?? undefined,
      clTemplateId: c.clTemplateId ?? undefined,
      generateCoverLetter: c.generateCoverLetter,
      lastRunAt: c.lastRunAt?.toISOString(),
      nextRunAt: c.nextRunAt?.toISOString(),
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    };
  }

  private toSuggestionDto(s: {
    id: string;
    externalJobId: string;
    jobTitle: string;
    company: string;
    location: string | null;
    jobUrl: string;
    postedAt: Date | null;
    matchScore: number | null;
    matchReasons: Prisma.JsonValue;
    status: 'PENDING' | 'APPROVED' | 'SKIPPED' | 'BLOCKED' | 'EXPIRED';
    decidedAt: Date | null;
    applicationId: string | null;
    createdAt: Date;
  }): AutoApplySuggestionDto {
    return {
      id: s.id,
      externalJobId: s.externalJobId,
      jobTitle: s.jobTitle,
      company: s.company,
      location: s.location ?? undefined,
      jobUrl: s.jobUrl,
      postedAt: s.postedAt?.toISOString(),
      matchScore: s.matchScore ?? undefined,
      matchReasons: (s.matchReasons as Record<string, unknown>) ?? undefined,
      status: s.status,
      decidedAt: s.decidedAt?.toISOString(),
      applicationId: s.applicationId ?? undefined,
      createdAt: s.createdAt.toISOString(),
    };
  }
}
