import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { JobPostingsModule } from '../job-postings/job-postings.module';
import { ApifyClient } from './apify.client';
import { LinkedInJobsService } from './linkedin-jobs.service';
import { LinkedInJobsController } from './linkedin-jobs.controller';

/**
 * LinkedInJobsModule (Pro feature)
 *
 * Provides LinkedIn job search via the Apify scraper actor and a
 * one-click import endpoint that persists results as JobPostings the
 * application wizard can consume.
 */
@Module({
  imports: [ConfigModule, JobPostingsModule],
  controllers: [LinkedInJobsController],
  providers: [ApifyClient, LinkedInJobsService],
  exports: [LinkedInJobsService],
})
export class LinkedInJobsModule {}
