import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { ApifyClient, ApifyLinkedInJobItem } from './apify.client';
import { JobPostingsService } from '../job-postings/job-postings.service';
import { JobPostingResponseDto } from '../job-postings/dto/job-posting-response.dto';
import {
  SearchLinkedInJobsDto,
  LinkedInSortBy,
  LinkedInCountry,
} from './dto/search-linkedin-jobs.dto';
import { LinkedInJobDto, LinkedInJobSearchResponseDto } from './dto/linkedin-job.dto';

/**
 * Display names for each country scope. Used to filter LinkedIn typeahead
 * results so a search for "Cologne" with country=DE doesn't return
 * "Cologne, Lombardy, Italy" as the first hit. The actual geoId is always
 * resolved on-demand via LinkedIn's public typeahead — we never hardcode
 * it here, because LinkedIn's IDs are not stable across regions and we'd
 * rather pay one fast HTTP roundtrip than ship stale numbers.
 */
const COUNTRY_DISPLAY_NAMES: Record<LinkedInCountry, string> = {
  [LinkedInCountry.Germany]: 'Germany',
  [LinkedInCountry.Austria]: 'Austria',
  [LinkedInCountry.Switzerland]: 'Switzerland',
  [LinkedInCountry.UnitedKingdom]: 'United Kingdom',
  [LinkedInCountry.UnitedStates]: 'United States',
  [LinkedInCountry.Netherlands]: 'Netherlands',
  [LinkedInCountry.France]: 'France',
  [LinkedInCountry.Spain]: 'Spain',
  [LinkedInCountry.Italy]: 'Italy',
  [LinkedInCountry.Worldwide]: 'Worldwide',
};

/**
 * Common German state / region abbreviations and aliases. LinkedIn's
 * typeahead doesn't recognise "NRW" — it returns Irish postal codes —
 * but it does resolve the full name. We pre-translate before lookup.
 */
const LOCATION_ALIASES: Record<string, string> = {
  // Germany — states
  'nrw': 'Nordrhein-Westfalen',
  'bw': 'Baden-Württemberg',
  'by': 'Bayern',
  'rp': 'Rheinland-Pfalz',
  'sh': 'Schleswig-Holstein',
  'mv': 'Mecklenburg-Vorpommern',
  'sn': 'Sachsen',
  'st': 'Sachsen-Anhalt',
  'th': 'Thüringen',
  'he': 'Hessen',
  'ni': 'Niedersachsen',
  'hh': 'Hamburg',
  'hb': 'Bremen',
  'be': 'Berlin',
  'bb': 'Brandenburg',
  'sl': 'Saarland',
  // Common name variants
  'köln': 'Cologne',
  'münchen': 'Munich',
  'wien': 'Vienna',
  'zürich': 'Zürich',
  'genève': 'Geneva',
  'mailand': 'Milan',
  'rom': 'Rome',
  'lissabon': 'Lisbon',
};

@Injectable()
export class LinkedInJobsService {
  private readonly logger = new Logger(LinkedInJobsService.name);

  /**
   * Cache of resolved geoIds. Locations don't change. Key:
   * `${normalizedQuery}::${country}`, value: geoId or `null` (no match).
   */
  private readonly geoCache = new Map<string, string | null>();

  constructor(
    private readonly apify: ApifyClient,
    private readonly jobPostings: JobPostingsService,
  ) {}

  /**
   * Search LinkedIn jobs via the Apify scraper.
   *
   * Builds a public LinkedIn search URL from the supplied filters,
   * delegates scraping to Apify, and normalizes the heterogeneous
   * response into our typed `LinkedInJobDto` shape.
   */
  async search(dto: SearchLinkedInJobsDto): Promise<LinkedInJobSearchResponseDto> {
    const count = dto.count ?? 25;
    const url = await this.buildSearchUrl(dto);

    this.logger.log(`LinkedIn search url=${url} count=${count}`);

    const rawItems = await this.apify.runLinkedInScraper({
      urls: [url],
      scrapeCompany: false,
      count,
    });

    const results = rawItems
      .map((item) => this.normalizeJob(item))
      .filter((job): job is LinkedInJobDto => job !== null);

    this.logger.log(`LinkedIn search returned ${results.length} normalized results`);

    return {
      results,
      totalCount: results.length,
      searchedAt: new Date().toISOString(),
      filters: dto as unknown as Record<string, unknown>,
    };
  }

  /**
   * Persist a LinkedIn job search result as a regular JobPosting that
   * the application wizard can consume.
   */
  async importJob(userId: string, job: LinkedInJobDto): Promise<JobPostingResponseDto> {
    const fullText = this.buildFullText(job);

    return this.jobPostings.create(userId, {
      title: job.title,
      company: job.company,
      location: job.location,
      url: job.url,
      fullText,
      employmentType: job.employmentType,
      salary: job.salary,
    });
  }

  // ----- Internal helpers ---------------------------------------------------

  /**
   * Build a LinkedIn jobs search URL that the Apify scraper can ingest.
   *
   * Reference: https://www.linkedin.com/jobs/search/?keywords=...&location=...&geoId=...
   *   &f_E=2,3 (experience)
   *   &f_JT=F,P (job type)
   *   &f_WT=2 (workplace: 1=on-site, 2=remote, 3=hybrid)
   *   &f_TPR=r604800 (date posted)
   *   &f_AL=true (easy apply)
   *   &sortBy=DD (date desc) or R (relevance)
   */
  private async buildSearchUrl(dto: SearchLinkedInJobsDto): Promise<string> {
    const params = new URLSearchParams();

    if (dto.keywords) params.set('keywords', dto.keywords);

    // --- Location resolution -------------------------------------------------
    // LinkedIn URL semantics: when `geoId` is present, LinkedIn ignores
    // ambiguous text in `location`. So we MUST send the right geoId or the
    // search collapses to country-wide (returns big-city jobs only).
    //
    // Strategy:
    //   1. Explicit `dto.geoId` from the caller wins.
    //   2. If user typed a location, resolve it via LinkedIn's public
    //      typeahead, filtered to the chosen country.
    //   3. If typeahead returns nothing, fall back to the country geoId.
    //   4. If no location AND no country (Worldwide), send no geoId.
    const country = dto.country ?? LinkedInCountry.Germany;
    const countryName = COUNTRY_DISPLAY_NAMES[country];

    let effectiveGeoId: string | undefined = dto.geoId;
    let effectiveLocation: string | undefined;

    if (!effectiveGeoId && dto.location?.trim()) {
      const resolved = await this.resolveGeoId(dto.location.trim(), country);
      if (resolved) {
        effectiveGeoId = resolved.geoId;
        effectiveLocation = resolved.displayName;
        this.logger.log(
          `Resolved location "${dto.location}" → geoId=${resolved.geoId} (${resolved.displayName})`,
        );
      } else {
        this.logger.warn(
          `Could not resolve location "${dto.location}" within ${countryName}; falling back to country geoId`,
        );
      }
    }

    // Country fallback (skip for Worldwide).
    if (!effectiveGeoId && country !== LinkedInCountry.Worldwide) {
      const fallback = await this.resolveGeoId(countryName, country);
      if (fallback) effectiveGeoId = fallback.geoId;
    }

    if (effectiveGeoId) params.set('geoId', effectiveGeoId);
    const finalLocation =
      effectiveLocation ??
      this.composeLocationString(dto.location, countryName, country);
    if (finalLocation) params.set('location', finalLocation);

    // --- Filters -------------------------------------------------------------
    if (dto.experienceLevel?.length) {
      params.set('f_E', dto.experienceLevel.join(','));
    }
    if (dto.jobType?.length) {
      params.set('f_JT', dto.jobType.join(','));
    }
    if (dto.remote?.length) {
      params.set('f_WT', dto.remote.join(','));
    }
    if (dto.datePosted) {
      params.set('f_TPR', dto.datePosted);
    }
    if (dto.easyApply) {
      params.set('f_AL', 'true');
    }
    params.set('sortBy', dto.sortBy ?? LinkedInSortBy.MostRecent);

    return `https://www.linkedin.com/jobs/search/?${params.toString()}`;
  }

  /**
   * Resolve a free-text location to a LinkedIn geoId via the public
   * typeahead endpoint. Returns the first hit whose displayName matches
   * the selected country (or any first hit when country=Worldwide).
   *
   * Cached in-memory — locations don't change.
   */
  private async resolveGeoId(
    query: string,
    country: LinkedInCountry,
  ): Promise<{ geoId: string; displayName: string } | null> {
    const normalized = query.trim().toLowerCase();
    const expanded = LOCATION_ALIASES[normalized] ?? query.trim();
    const cacheKey = `${expanded.toLowerCase()}::${country}`;

    if (this.geoCache.has(cacheKey)) {
      const cached = this.geoCache.get(cacheKey);
      if (cached === null || cached === undefined) return null;
      // For cached hits we re-use the displayName the typeahead returned
      // (stored as JSON). Keep it simple: cache value is `geoId|displayName`.
      const [geoId, ...rest] = cached.split('|');
      return { geoId, displayName: rest.join('|') || expanded };
    }

    try {
      const { data } = await axios.get<
        Array<{ id: string; type: string; displayName: string }>
      >('https://www.linkedin.com/jobs-guest/api/typeaheadHits', {
        params: { query: expanded, typeaheadType: 'GEO' },
        timeout: 5_000,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'application/json',
        },
      });

      if (!Array.isArray(data) || data.length === 0) {
        this.geoCache.set(cacheKey, null);
        return null;
      }

      const countryName = COUNTRY_DISPLAY_NAMES[country].toLowerCase();
      const geoHits = data.filter((d) => d.type === 'GEO');

      const match =
        country === LinkedInCountry.Worldwide
          ? geoHits[0]
          : geoHits.find((d) => d.displayName.toLowerCase().includes(countryName)) ??
            // If nothing in the chosen country matches, refuse — don't pick
            // the wrong country (the original Azerbaijan bug).
            null;

      if (!match) {
        this.geoCache.set(cacheKey, null);
        return null;
      }

      this.geoCache.set(cacheKey, `${match.id}|${match.displayName}`);
      return { geoId: match.id, displayName: match.displayName };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Typeahead lookup failed for "${expanded}": ${msg}`);
      // Don't cache transient failures — retry next call.
      return null;
    }
  }

  /**
   * Build the human-readable `location=` query value.
   *  - "NRW" + Germany   → "NRW, Germany"
   *  - "Berlin, Germany" → "Berlin, Germany"  (no double-append)
   *  - undefined         → "Germany"
   *  - country=Worldwide → undefined (no scoping)
   */
  private composeLocationString(
    raw: string | undefined,
    countryName: string,
    country: LinkedInCountry,
  ): string | undefined {
    if (country === LinkedInCountry.Worldwide) {
      return raw?.trim() || undefined;
    }
    const trimmed = raw?.trim();
    if (!trimmed) return countryName;
    if (trimmed.toLowerCase().includes(countryName.toLowerCase())) {
      return trimmed;
    }
    // Also catch German "Deutschland" / Swiss "Schweiz" etc. for German users.
    const germanAlias: Partial<Record<LinkedInCountry, string>> = {
      [LinkedInCountry.Germany]: 'deutschland',
      [LinkedInCountry.Switzerland]: 'schweiz',
      [LinkedInCountry.Austria]: 'österreich',
    };
    const alias = germanAlias[country];
    if (alias && trimmed.toLowerCase().includes(alias)) {
      return trimmed;
    }
    return `${trimmed}, ${countryName}`;
  }

  /**
   * Normalize a raw Apify item into our typed shape.
   * Returns null when the item is missing required fields (id/title/company/url).
   */
  private normalizeJob(item: ApifyLinkedInJobItem): LinkedInJobDto | null {
    const id = item.id ?? item.jobId ?? this.extractIdFromUrn(item.trackingUrn);
    const title = item.title ?? item.positionName;
    const company =
      typeof item.company === 'string' ? item.company : item.company?.name ?? item.companyName;
    const url = item.url ?? item.link ?? item.jobUrl;

    if (!id || !title || !company || !url) {
      return null;
    }

    const companyUrl =
      typeof item.company === 'object' ? item.company?.url : item.companyUrl;
    const companyLogoUrl =
      typeof item.company === 'object' ? item.company?.logo : item.companyLogo;

    return {
      id: String(id),
      title: this.cleanText(title),
      company: this.cleanText(company),
      companyUrl: companyUrl ?? undefined,
      companyLogoUrl: companyLogoUrl ?? undefined,
      location: item.location ? this.cleanText(item.location) : undefined,
      workType: item.workplaceType ?? item.workType ?? item.remote ?? undefined,
      employmentType: item.employmentType ?? item.contractType ?? undefined,
      seniority: item.seniorityLevel ?? item.experienceLevel ?? undefined,
      postedAt: this.normalizePostedAt(item),
      applicantsCount: this.normalizeApplicantsCount(
        item.applicantsCount ?? item.applicants ?? item.numApplicants,
      ),
      salary: item.salary ?? item.salaryRange ?? undefined,
      url,
      description: this.normalizeDescription(item),
    };
  }

  private normalizeDescription(item: ApifyLinkedInJobItem): string | undefined {
    const text =
      item.descriptionText ??
      item.description ??
      (item.descriptionHtml ? this.stripHtml(item.descriptionHtml) : undefined);
    if (!text) return undefined;
    const cleaned = this.cleanText(text);
    // Cap at ~20k chars to keep payloads sane and avoid blowing up the LLM
    // prompt later when the user imports the job.
    return cleaned.length > 20_000 ? cleaned.slice(0, 20_000) : cleaned;
  }

  private normalizePostedAt(item: ApifyLinkedInJobItem): string | undefined {
    const value = item.postedAt ?? item.publishedAt ?? item.postedTime ?? item.listedAt;
    if (!value) return undefined;
    if (typeof value === 'number') {
      // Apify sometimes returns epoch millis
      return new Date(value).toISOString();
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
  }

  /**
   * Coerce the applicantsCount Apify returns to a non-negative integer.
   *
   * The actor is loosely typed and we've seen all of:
   *   • `200`         → 200
   *   • `"200+"`      → 200
   *   • `"Über 100"`  → 100
   *   • `0.5`         → 0  (some scrapers return ratios)
   *   • `-1`          → undefined  (sentinel for "unknown")
   *   • `null`/missing → undefined
   *
   * Returns `undefined` when no usable number can be extracted, so the
   * field stays optional and class-validator's `@IsInt @Min(0)` passes
   * cleanly on the round-trip /import call.
   */
  private normalizeApplicantsCount(raw: unknown): number | undefined {
    if (raw === null || raw === undefined) return undefined;
    let n: number | undefined;
    if (typeof raw === 'number') n = raw;
    else if (typeof raw === 'string') {
      const match = raw.match(/-?\d+/);
      if (match) n = Number(match[0]);
    }
    if (n === undefined || !Number.isFinite(n) || n < 0) return undefined;
    return Math.floor(n);
  }

  private extractIdFromUrn(urn: string | undefined): string | undefined {
    if (!urn) return undefined;
    // urn:li:fsd_jobPosting:1234567890 → 1234567890
    const match = urn.match(/(\d{6,})/);
    return match ? match[1] : undefined;
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]+>/g, ' ');
  }

  private cleanText(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
  }

  private buildFullText(job: LinkedInJobDto): string {
    const lines: string[] = [];
    lines.push(`${job.title} – ${job.company}`);
    if (job.location) lines.push(`Standort: ${job.location}`);
    if (job.workType) lines.push(`Arbeitsmodell: ${job.workType}`);
    if (job.employmentType) lines.push(`Beschäftigungsart: ${job.employmentType}`);
    if (job.seniority) lines.push(`Erfahrungslevel: ${job.seniority}`);
    if (job.salary) lines.push(`Gehalt: ${job.salary}`);
    lines.push(`Quelle: ${job.url}`);
    if (job.description) {
      lines.push('');
      lines.push(job.description);
    }
    return lines.join('\n');
  }
}
