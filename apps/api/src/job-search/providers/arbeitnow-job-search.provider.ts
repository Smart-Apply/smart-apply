import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import axios, { AxiosError, AxiosInstance } from 'axios';
import { JobPostingsService } from '../../job-postings/job-postings.service';
import { JobPostingResponseDto } from '../../job-postings/dto/job-posting-response.dto';
import { JobSearchProvider, JobSourceId } from '../job-search-provider.interface';
import { UnifiedJobDto } from '../dto/unified-job.dto';
import { UnifiedJobSearchRequestDto } from '../dto/unified-job-search-request.dto';

/**
 * Raw item shape returned by the Arbeitnow public job-board API.
 *
 * Endpoint: https://www.arbeitnow.com/api/job-board-api?search=<q>&page=<n>
 * Docs:     https://www.arbeitnow.com/api/job-board-api
 *
 * Only fields we consume are typed; everything else is ignored. The API
 * is unauthenticated, German-market focused, and serves a few thousand
 * fresh openings per request — perfect free secondary source alongside
 * the paid Apify-LinkedIn provider.
 */
interface ArbeitnowJobItem {
  slug: string;
  company_name: string;
  title: string;
  description?: string; // HTML
  remote?: boolean;
  url: string;
  tags?: string[];
  job_types?: string[];
  location?: string;
  created_at?: number; // unix seconds
}

interface ArbeitnowResponse {
  data: ArbeitnowJobItem[];
}

/**
 * Arbeitnow provider — free, ToS-compliant, German-first.
 *
 * Why this exists alongside the LinkedIn (Apify) provider:
 *   - LinkedIn's scraper AND-matches all keywords, so multi-term
 *     queries like "Werkstudent Wirtschaftsinformatik" frequently
 *     return zero results even when matching jobs exist.
 *   - Arbeitnow indexes thousands of small German employers that
 *     LinkedIn doesn't surface and has stronger Werkstudent /
 *     Praktikum / Berufseinstieg coverage.
 *   - Costs nothing per call (vs. ~$0.01–0.05 for Apify) and has no
 *     legal grey zone — it's an official REST API, not scraping.
 *
 * Caveats:
 *   - No native location/country filter — we filter client-side after
 *     the fetch.
 *   - No `applicantsCount` field (left undefined on every result).
 *   - Search relevance is whole-corpus rather than location-anchored,
 *     so combining with LinkedIn results gives the best UX.
 */
@Injectable()
export class ArbeitnowJobSearchProvider implements JobSearchProvider {
  private readonly logger = new Logger(ArbeitnowJobSearchProvider.name);
  private readonly http: AxiosInstance;

  readonly id: JobSourceId = 'arbeitnow';
  readonly name = 'Arbeitnow';
  /** Free public API — usable by FREE-tier users. */
  readonly requiresPremium = false;

  constructor(private readonly jobPostings: JobPostingsService) {
    this.http = axios.create({
      baseURL: 'https://www.arbeitnow.com/api',
      // Arbeitnow normally responds in <1s; cap at 15s so a slow upstream
      // doesn't block the unified fan-out search for the user.
      timeout: 15_000,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'smart-apply/1.0 (+https://smart-apply.io)',
      },
    });
  }

  /**
   * Always available — public API, no token required. Returning `true`
   * unconditionally also means the provider participates in every
   * fan-out search by default.
   */
  isConfigured(): boolean {
    return true;
  }

  async search(request: UnifiedJobSearchRequestDto): Promise<UnifiedJobDto[]> {
    const limit = request.perSourceLimit ?? 25;
    const params: Record<string, string | number> = { page: 1 };
    if (request.keywords?.trim()) {
      params.search = request.keywords.trim();
    }

    let raw: ArbeitnowJobItem[];
    try {
      const { data } = await this.http.get<ArbeitnowResponse>('/job-board-api', { params });
      raw = Array.isArray(data?.data) ? data.data : [];
    } catch (err) {
      const ax = err as AxiosError;
      this.logger.warn(
        `Arbeitnow search failed (status=${ax.response?.status ?? 'n/a'}): ${ax.message}`,
      );
      // Arbeitnow is a non-critical secondary source. We translate
      // network errors into a 502 *only when explicitly invoked alone*;
      // when invoked as part of a fan-out, JobSearchService catches the
      // exception and reports `status: 'error'` for this source while
      // still returning results from other providers.
      if (ax.response && ax.response.status >= 500) {
        throw new BadGatewayException('Arbeitnow upstream returned a server error');
      }
      throw new ServiceUnavailableException('Arbeitnow is temporarily unavailable');
    }

    const filtered = this.applyClientSideFilters(raw, request).slice(0, limit);
    return filtered.map((item) => this.toUnified(item));
  }

  async importJob(userId: string, job: UnifiedJobDto): Promise<JobPostingResponseDto> {
    return this.jobPostings.create(userId, {
      title: job.title,
      company: job.company,
      location: job.location,
      url: job.url,
      fullText: this.buildFullText(job),
      employmentType: job.employmentType,
      salary: job.salary,
    });
  }

  // ----- Internal helpers ---------------------------------------------------

  /**
   * Arbeitnow doesn't expose a location or remote filter on the API
   * itself. We approximate both client-side:
   *   - `remoteOnly: true`     → keep items with `remote === true` OR
   *                              "Remote" in tags
   *   - `location: <city>`     → case-insensitive substring match
   *                              against `item.location` (we accept
   *                              false-negatives over false-positives)
   *
   * Country filtering is intentionally NOT applied — Arbeitnow's corpus
   * is overwhelmingly Germany-focused, and adding country detection
   * would just throw away usable results.
   */
  private applyClientSideFilters(
    items: ArbeitnowJobItem[],
    request: UnifiedJobSearchRequestDto,
  ): ArbeitnowJobItem[] {
    let result = items;
    if (request.remoteOnly) {
      result = result.filter(
        (i) => i.remote === true || (i.tags ?? []).some((t) => /remote/i.test(t)),
      );
    }
    if (request.location?.trim()) {
      const needle = request.location.trim().toLowerCase();
      result = result.filter((i) => (i.location ?? '').toLowerCase().includes(needle));
    }
    return result;
  }

  private toUnified(item: ArbeitnowJobItem): UnifiedJobDto {
    const description = item.description ? this.stripHtml(item.description) : undefined;
    const remoteTag = item.remote ? 'Remote' : undefined;
    const employmentType = item.job_types?.[0];

    return {
      source: this.id,
      externalId: item.slug,
      title: this.cleanText(item.title),
      company: this.cleanText(item.company_name),
      location: item.location ? this.cleanText(item.location) : undefined,
      workType: remoteTag,
      employmentType: employmentType ? this.cleanText(employmentType) : undefined,
      postedAt: item.created_at
        ? new Date(item.created_at * 1000).toISOString()
        : undefined,
      url: item.url,
      description: description && description.length > 20_000
        ? description.slice(0, 20_000)
        : description,
      tags: item.tags?.length ? item.tags : undefined,
    };
  }

  private buildFullText(job: UnifiedJobDto): string {
    const lines: string[] = [];
    lines.push(`${job.title} – ${job.company}`);
    if (job.location) lines.push(`Standort: ${job.location}`);
    if (job.workType) lines.push(`Arbeitsmodell: ${job.workType}`);
    if (job.employmentType) lines.push(`Beschäftigungsart: ${job.employmentType}`);
    if (job.salary) lines.push(`Gehalt: ${job.salary}`);
    lines.push(`Quelle: ${job.url}`);
    if (job.description) {
      lines.push('');
      lines.push(job.description);
    }
    return lines.join('\n');
  }

  private stripHtml(html: string): string {
    return this.cleanText(html.replace(/<[^>]+>/g, ' '));
  }

  private cleanText(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
  }
}
