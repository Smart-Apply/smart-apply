import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  BadGatewayException,
} from '@nestjs/common';
import axios, { AxiosInstance, AxiosError } from 'axios';
import { ConfigService } from '../config/config.service';

/**
 * Raw item shape returned by the
 * `curious_coder/linkedin-jobs-scraper` Apify actor.
 *
 * The actor's schema is loosely typed (LinkedIn changes frequently), so we
 * only declare the fields we actually consume and treat everything as
 * optional.
 */
export interface ApifyLinkedInJobItem {
  id?: string;
  jobId?: string;
  trackingUrn?: string;
  title?: string;
  positionName?: string;
  companyName?: string;
  company?: { name?: string; url?: string; logo?: string } | string;
  companyUrl?: string;
  companyLogo?: string;
  location?: string;
  workplaceType?: string;
  workType?: string;
  remote?: string;
  employmentType?: string;
  contractType?: string;
  experienceLevel?: string;
  seniorityLevel?: string;
  postedAt?: string;
  postedTime?: string;
  publishedAt?: string;
  listedAt?: string | number;
  applicantsCount?: number;
  applicants?: number;
  numApplicants?: number;
  salary?: string;
  salaryRange?: string;
  link?: string;
  url?: string;
  jobUrl?: string;
  description?: string;
  descriptionText?: string;
  descriptionHtml?: string;
}

/**
 * Thin wrapper around the Apify REST API.
 *
 * We hit the synchronous `run-sync-get-dataset-items` endpoint so the
 * caller blocks until the actor finishes and dataset items are returned
 * inline — perfect for our short-lived (≤30s) search use case.
 *
 * Docs: https://docs.apify.com/api/v2#/reference/actors/run-actor-synchronously-and-get-dataset-items
 */
@Injectable()
export class ApifyClient {
  private readonly logger = new Logger(ApifyClient.name);
  private readonly http: AxiosInstance;

  constructor(private readonly config: ConfigService) {
    this.http = axios.create({
      baseURL: 'https://api.apify.com/v2',
      // LinkedIn scraping for 25–100 results typically needs 60–150s.
      // Apify's sync endpoint hard-caps at 300s, so we sit comfortably
      // below that. The actor input also gets `timeoutSecs` so the actor
      // itself bails before the HTTP socket would.
      timeout: 240_000,
    });
  }

  /**
   * Returns true when an APIFY_TOKEN is configured.
   * Use this to short-circuit with a 503 before doing any work.
   */
  isConfigured(): boolean {
    return Boolean(this.config.apifyToken);
  }

  /**
   * Run the LinkedIn scraper synchronously and return the raw dataset items.
   *
   * @param input Actor input (LinkedIn search URLs + flags)
   */
  async runLinkedInScraper(input: {
    urls: string[];
    scrapeCompany?: boolean;
    count?: number;
  }): Promise<ApifyLinkedInJobItem[]> {
    const token = this.config.apifyToken;
    if (!token) {
      throw new ServiceUnavailableException(
        'LinkedIn-Suche ist nicht konfiguriert. Bitte APIFY_TOKEN setzen.',
      );
    }

    const actorId = this.config.apifyLinkedInActorId;
    const url = `/acts/${actorId}/run-sync-get-dataset-items`;

    this.logger.log(
      `Calling Apify actor=${actorId} count=${input.count ?? 25} urls=${input.urls.length}`,
    );

    try {
      const { data } = await this.http.post<ApifyLinkedInJobItem[]>(
        url,
        // Pass `timeoutSecs` so the actor self-terminates before our
        // HTTP socket would, giving us a clean Apify error instead of
        // an opaque axios ECONNABORTED.
        { ...input, timeoutSecs: 200 },
        {
          params: { token, timeout: 220 },
          headers: { 'Content-Type': 'application/json' },
        },
      );

      if (!Array.isArray(data)) {
        this.logger.warn(`Apify returned non-array response: ${typeof data}`);
        return [];
      }
      return data;
    } catch (error) {
      const axiosError = error as AxiosError<{ error?: { message?: string } }>;
      const status = axiosError.response?.status;
      const code = axiosError.code;
      const message =
        axiosError.response?.data?.error?.message ?? axiosError.message ?? 'Unknown Apify error';

      this.logger.error(`Apify call failed (status=${status}, code=${code}): ${message}`);

      if (status === 401 || status === 403) {
        throw new ServiceUnavailableException('Apify-Token ungültig oder abgelaufen.');
      }
      if (code === 'ECONNABORTED' || code === 'ETIMEDOUT') {
        throw new BadGatewayException(
          'LinkedIn-Suche hat zu lange gedauert. Bitte versuche es mit weniger Ergebnissen oder spezifischeren Filtern erneut.',
        );
      }
      throw new BadGatewayException(`LinkedIn-Suche fehlgeschlagen: ${message}`);
    }
  }
}
