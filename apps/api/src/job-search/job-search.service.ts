import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { JobPostingResponseDto } from '../job-postings/dto/job-posting-response.dto';
import {
  JOB_SEARCH_PROVIDERS,
  JobSearchProvider,
  JobSourceId,
} from './job-search-provider.interface';
import { UnifiedJobDto, JobSearchSourceStatusDto } from './dto/unified-job.dto';
import { UnifiedJobSearchRequestDto } from './dto/unified-job-search-request.dto';

/**
 * Registry + fan-out orchestrator for `JobSearchProvider` implementations.
 *
 * - Resolves `request.sources` against the configured provider set.
 * - Optionally filters out paid sources for non-Premium callers.
 * - Runs each provider IN PARALLEL with per-source try/catch so one
 *   failing source doesn't take down the whole response.
 * - Stamps a `JobSearchSourceStatusDto` per source so the frontend can
 *   render "Arbeitnow: 12 jobs · LinkedIn: skipped (Premium required)".
 *
 * Adding a new provider is a one-liner — bind it under
 * `JOB_SEARCH_PROVIDERS` in `JobSearchModule.providers` and it
 * automatically participates in fan-out.
 */
@Injectable()
export class JobSearchService {
  private readonly logger = new Logger(JobSearchService.name);

  constructor(
    @Inject(JOB_SEARCH_PROVIDERS)
    private readonly providers: JobSearchProvider[],
  ) {}

  /**
   * Public list of providers — used by the controller's `/sources`
   * endpoint so the frontend can render a "Search in:" multi-select
   * with accurate availability state per environment.
   */
  listProviders(opts: { isPremium: boolean }): Array<{
    id: JobSourceId;
    name: string;
    requiresPremium: boolean;
    available: boolean;
  }> {
    return this.providers.map((p) => ({
      id: p.id,
      name: p.name,
      requiresPremium: p.requiresPremium,
      available: p.isConfigured() && (!p.requiresPremium || opts.isPremium),
    }));
  }

  /**
   * Resolve which providers to run for this request.
   *
   * Resolution order:
   *   1. If `request.sources` is set, take exactly those (caller intent wins).
   *   2. Otherwise take ALL configured providers.
   *   3. Drop providers that aren't configured (e.g. Apify token missing).
   *   4. Drop premium providers when the caller isn't on a paid plan.
   *
   * Throws when the resulting set is empty AND the caller explicitly
   * asked for unavailable sources — silent on full fan-out (other
   * sources still answer).
   */
  async search(
    request: UnifiedJobSearchRequestDto,
    opts: { isPremium: boolean },
  ): Promise<{
    results: UnifiedJobDto[];
    sources: JobSearchSourceStatusDto[];
  }> {
    const requested =
      request.sources && request.sources.length > 0
        ? new Set<JobSourceId>(request.sources)
        : null;

    const sourceStatuses: JobSearchSourceStatusDto[] = [];
    const tasks: Array<Promise<UnifiedJobDto[]>> = [];

    for (const provider of this.providers) {
      // Skip providers the caller didn't ask for (when explicit set given).
      if (requested && !requested.has(provider.id)) continue;

      if (!provider.isConfigured()) {
        sourceStatuses.push({
          source: provider.id,
          count: 0,
          status: 'skipped',
          reason: 'Provider not configured',
        });
        continue;
      }

      if (provider.requiresPremium && !opts.isPremium) {
        sourceStatuses.push({
          source: provider.id,
          count: 0,
          status: 'skipped',
          reason: 'Premium tier required',
        });
        continue;
      }

      tasks.push(
        provider.search(request).then(
          (jobs) => {
            sourceStatuses.push({
              source: provider.id,
              count: jobs.length,
              status: 'ok',
            });
            return jobs;
          },
          (err: Error) => {
            this.logger.warn(
              `Provider ${provider.id} failed: ${err.message ?? String(err)}`,
            );
            sourceStatuses.push({
              source: provider.id,
              count: 0,
              status: 'error',
              reason: err.message ?? 'Unknown error',
            });
            return [] as UnifiedJobDto[];
          },
        ),
      );
    }

    // If the caller named explicit sources and EVERY single one was
    // skipped/errored before search even ran, surface that as a 503
    // instead of returning an empty success — that's a config / tier
    // problem the user should know about.
    const hadAnyRunnable = tasks.length > 0;
    if (!hadAnyRunnable && requested) {
      throw new ServiceUnavailableException(
        'None of the requested job-search sources are available for your tier or environment.',
      );
    }

    const settled = await Promise.all(tasks);
    const merged = this.dedupe(settled.flat());

    return { results: merged, sources: sourceStatuses };
  }

  /**
   * Persist a search result via its originating provider. We dispatch
   * on `job.source` rather than guessing — providers know how to
   * compose the right `fullText` from their native fields.
   */
  async importJob(
    userId: string,
    job: UnifiedJobDto,
    opts: { isPremium: boolean },
  ): Promise<JobPostingResponseDto> {
    const provider = this.providers.find((p) => p.id === job.source);
    if (!provider) {
      throw new NotFoundException(`Unknown job source: ${job.source}`);
    }
    if (provider.requiresPremium && !opts.isPremium) {
      throw new ForbiddenException(
        `Importing from ${provider.name} requires a Premium subscription.`,
      );
    }
    return provider.importJob(userId, job);
  }

  /**
   * Cross-source dedup — providers occasionally surface the same role.
   * We key on a normalized `(title, company)` pair because URLs differ
   * across providers even for the same job. First-seen wins, which
   * implicitly favours the source order in `JobSearchModule.providers`.
   */
  private dedupe(jobs: UnifiedJobDto[]): UnifiedJobDto[] {
    const seen = new Set<string>();
    const out: UnifiedJobDto[] = [];
    for (const job of jobs) {
      const key = `${job.title.toLowerCase().trim()}|${job.company.toLowerCase().trim()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(job);
    }
    return out;
  }
}
