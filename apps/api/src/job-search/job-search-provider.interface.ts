import { JobPostingResponseDto } from '../job-postings/dto/job-posting-response.dto';
import { UnifiedJobDto } from './dto/unified-job.dto';
import { UnifiedJobSearchRequestDto } from './dto/unified-job-search-request.dto';

/**
 * Stable identifier for a job source. Stamped on every result via
 * `UnifiedJobDto.source` so the frontend can render provider badges and
 * the controller can dispatch `/import` calls to the right backend.
 *
 * Add new providers by extending this union AND registering an
 * implementation in `JobSearchService` — the DI container picks them up
 * via the `JOB_SEARCH_PROVIDERS` multi-provider token.
 */
export type JobSourceId = 'linkedin' | 'arbeitnow';

/**
 * Pluggable job-search backend. One implementation per source (LinkedIn
 * via Apify, Arbeitnow public API, JSearch later, …).
 *
 * Mirrors the pattern already used for `STORAGE_DRIVER`, `LLM_PROVIDER`
 * and `JOBS_DRIVER` — concrete implementations are wired up in
 * `JobSearchModule` and selected at request time by the
 * `UnifiedJobSearchRequestDto.sources` field (default = all configured).
 */
export interface JobSearchProvider {
  /** Stable, lowercase identifier (matches `JobSourceId`). */
  readonly id: JobSourceId;

  /** Display name for UI and logs (e.g. "LinkedIn", "Arbeitnow"). */
  readonly name: string;

  /**
   * `true` when the source itself is gated behind paid scraping infra
   * (Apify, JSearch, …) and should be hidden from FREE-tier users.
   *
   * Sources that hit a free public API (Arbeitnow) return `false` and
   * are usable by everyone.
   */
  readonly requiresPremium: boolean;

  /**
   * Whether the source is usable in the current environment (token set,
   * actor ID configured, …). When `false`, `JobSearchService` skips
   * this provider silently in fan-out searches and returns 503 only if
   * the caller explicitly requested it.
   */
  isConfigured(): boolean;

  /**
   * Run the search. Implementations:
   *   - Translate the unified request to their native shape
   *   - Hit the upstream API
   *   - Normalize results to `UnifiedJobDto` and stamp `source = this.id`
   *   - Throw `ServiceUnavailableException` when their backend is down
   */
  search(request: UnifiedJobSearchRequestDto): Promise<UnifiedJobDto[]>;

  /**
   * Persist the supplied search result as a `JobPosting` so the
   * application wizard can consume it. Each provider knows best how to
   * compose `fullText` from its native fields, hence per-provider
   * implementation rather than one generic adapter.
   */
  importJob(userId: string, job: UnifiedJobDto): Promise<JobPostingResponseDto>;
}

/** DI multi-provider token. Bind one entry per concrete provider. */
export const JOB_SEARCH_PROVIDERS = Symbol('JOB_SEARCH_PROVIDERS');
