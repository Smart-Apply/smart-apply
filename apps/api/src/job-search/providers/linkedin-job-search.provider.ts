import { Injectable, Logger } from '@nestjs/common';
import { ApifyClient } from '../../linkedin-jobs/apify.client';
import { LinkedInJobsService } from '../../linkedin-jobs/linkedin-jobs.service';
import {
  LinkedInRemoteFilter,
  SearchLinkedInJobsDto,
} from '../../linkedin-jobs/dto/search-linkedin-jobs.dto';
import { LinkedInJobDto } from '../../linkedin-jobs/dto/linkedin-job.dto';
import { JobPostingResponseDto } from '../../job-postings/dto/job-posting-response.dto';
import { JobSearchProvider, JobSourceId } from '../job-search-provider.interface';
import { UnifiedJobDto } from '../dto/unified-job.dto';
import { UnifiedJobSearchRequestDto } from '../dto/unified-job-search-request.dto';

/**
 * `JobSearchProvider` wrapper around the existing Apify-backed LinkedIn
 * scraper. Translates the unified request to `SearchLinkedInJobsDto`,
 * delegates to `LinkedInJobsService`, and re-stamps each result with
 * `source = 'linkedin'`.
 *
 * Premium-only: scraping LinkedIn costs ~$0.01–0.05 per call via Apify,
 * so we keep this gated behind the existing `linkedinImport` feature
 * flag through the controller.
 */
@Injectable()
export class LinkedInJobSearchProvider implements JobSearchProvider {
  private readonly logger = new Logger(LinkedInJobSearchProvider.name);
  readonly id: JobSourceId = 'linkedin';
  readonly name = 'LinkedIn';
  readonly requiresPremium = true;

  constructor(
    private readonly linkedinJobs: LinkedInJobsService,
    private readonly apify: ApifyClient,
  ) {}

  isConfigured(): boolean {
    return this.apify.isConfigured();
  }

  async search(request: UnifiedJobSearchRequestDto): Promise<UnifiedJobDto[]> {
    const dto: SearchLinkedInJobsDto = {
      keywords: request.keywords,
      location: request.location,
      country: request.country,
      // LinkedIn URL semantics: f_WT=2 == remote-only. Translate the
      // unified `remoteOnly` flag here so the LinkedIn provider behaves
      // consistently with Arbeitnow's `remote === true` filter.
      remote: request.remoteOnly ? [LinkedInRemoteFilter.Remote] : undefined,
      count: request.perSourceLimit ?? 25,
    };

    const response = await this.linkedinJobs.search(dto);
    return response.results.map((job) => this.toUnified(job));
  }

  async importJob(userId: string, job: UnifiedJobDto): Promise<JobPostingResponseDto> {
    // Round-trip through LinkedInJobsService.importJob, which already
    // composes the right `fullText` and persists the JobPosting.
    return this.linkedinJobs.importJob(userId, this.toLinkedInJobDto(job));
  }

  // ----- Internal mapping ---------------------------------------------------

  private toUnified(job: LinkedInJobDto): UnifiedJobDto {
    return {
      source: this.id,
      externalId: job.id,
      title: job.title,
      company: job.company,
      companyLogoUrl: job.companyLogoUrl,
      location: job.location,
      workType: job.workType,
      employmentType: job.employmentType,
      postedAt: job.postedAt,
      applicantsCount: job.applicantsCount,
      salary: job.salary,
      url: job.url,
      description: job.description,
      tags: job.seniority ? [job.seniority] : undefined,
    };
  }

  private toLinkedInJobDto(job: UnifiedJobDto): LinkedInJobDto {
    return {
      id: job.externalId,
      title: job.title,
      company: job.company,
      companyLogoUrl: job.companyLogoUrl,
      location: job.location,
      workType: job.workType,
      employmentType: job.employmentType,
      postedAt: job.postedAt,
      applicantsCount: job.applicantsCount,
      salary: job.salary,
      url: job.url,
      description: job.description,
      seniority: job.tags?.[0],
    };
  }
}
