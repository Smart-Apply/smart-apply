import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { JobPostingsModule } from '../job-postings/job-postings.module';
import { LinkedInJobsModule } from '../linkedin-jobs/linkedin-jobs.module';
import { SubscriptionModule } from '../subscription/subscription.module';

import { JobSearchController } from './job-search.controller';
import { JobSearchService } from './job-search.service';
import {
  JOB_SEARCH_PROVIDERS,
  JobSearchProvider,
} from './job-search-provider.interface';
import { LinkedInJobSearchProvider } from './providers/linkedin-job-search.provider';
import { ArbeitnowJobSearchProvider } from './providers/arbeitnow-job-search.provider';

/**
 * JobSearchModule — pluggable, multi-source job search.
 *
 * Provider order in the `useFactory` array below decides:
 *   1. Which source's listing wins on duplicate (title, company) keys
 *      (first-seen wins → put higher-quality sources first).
 *   2. The order returned by `GET /job-search/sources`.
 *
 * To add a new provider:
 *   - Implement `JobSearchProvider` in `./providers/<source>-job-search.provider.ts`
 *   - Add its class to the `providers` + `useFactory` arrays here
 *   - Extend `JobSourceId` in `job-search-provider.interface.ts`
 *
 * No other file needs changes — the service, controller, and DTOs all
 * pick the new source up automatically.
 */
@Module({
  imports: [ConfigModule, JobPostingsModule, LinkedInJobsModule, SubscriptionModule],
  controllers: [JobSearchController],
  providers: [
    JobSearchService,
    LinkedInJobSearchProvider,
    ArbeitnowJobSearchProvider,
    {
      provide: JOB_SEARCH_PROVIDERS,
      useFactory: (
        linkedin: LinkedInJobSearchProvider,
        arbeitnow: ArbeitnowJobSearchProvider,
      ): JobSearchProvider[] => [linkedin, arbeitnow],
      inject: [LinkedInJobSearchProvider, ArbeitnowJobSearchProvider],
    },
  ],
  exports: [JobSearchService],
})
export class JobSearchModule {}
