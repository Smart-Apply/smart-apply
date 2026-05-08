import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { Sanitize } from '../../common/decorators/sanitize.decorator';
import type { JobSourceId } from '../job-search-provider.interface';

/**
 * Provider-agnostic job result.
 *
 * Every `JobSearchProvider.search()` returns this shape — providers fill
 * in what they know and leave the rest `undefined`. The `source` field
 * routes the round-trip `/import` call to the right provider.
 *
 * Fields are deliberately a strict subset of the LinkedIn DTO so the
 * frontend can render both source types with one card component.
 */
export class UnifiedJobDto {
  @ApiProperty({
    description: 'Source identifier — picks which provider handles /import',
    enum: ['linkedin', 'arbeitnow'],
  })
  @IsString()
  @IsIn(['linkedin', 'arbeitnow'])
  source: JobSourceId;

  @ApiProperty({ description: 'Provider-native job ID (LinkedIn jobId, Arbeitnow slug, …)' })
  @IsString()
  @MaxLength(256)
  externalId: string;

  @ApiProperty({ description: 'Job title' })
  @IsString()
  @MaxLength(300)
  @Sanitize()
  title: string;

  @ApiProperty({ description: 'Company name' })
  @IsString()
  @MaxLength(300)
  @Sanitize()
  company: string;

  @ApiPropertyOptional({ description: 'Company logo URL' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  companyLogoUrl?: string;

  @ApiPropertyOptional({ description: 'Job location (city or region)' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  @Sanitize()
  location?: string;

  @ApiPropertyOptional({ description: 'Work mode (remote / hybrid / on-site, free text)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  workType?: string;

  @ApiPropertyOptional({ description: 'Employment type (full-time / part-time / internship / …)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  employmentType?: string;

  @ApiPropertyOptional({ description: 'Posted-at timestamp (ISO 8601)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  postedAt?: string;

  @ApiPropertyOptional({
    description: 'Number of applicants (LinkedIn only — Arbeitnow does not expose this)',
  })
  @IsOptional()
  // Tolerant coercion — same logic as LinkedInJobDto.applicantsCount: providers
  // may pass strings ("200+"), floats, negatives. Strip to non-negative int or
  // drop the field. Defense-in-depth for cached browser results sent to /import.
  @Transform(({ value }) => {
    if (value === null || value === undefined) return undefined;
    let n: number | undefined;
    if (typeof value === 'number') n = value;
    else if (typeof value === 'string') {
      const m = value.match(/-?\d+/);
      if (m) n = Number(m[0]);
    }
    if (n === undefined || !Number.isFinite(n) || n < 0) return undefined;
    return Math.floor(n);
  })
  @IsInt()
  @Min(0)
  applicantsCount?: number;

  @ApiPropertyOptional({ description: 'Salary string when available' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Sanitize()
  salary?: string;

  @ApiProperty({ description: 'Public URL of the job posting' })
  @IsUrl({ require_tld: true })
  @MaxLength(1000)
  url: string;

  @ApiPropertyOptional({ description: 'Plain-text job description (HTML stripped)' })
  @IsOptional()
  @IsString()
  @Sanitize()
  description?: string;

  @ApiPropertyOptional({
    description: 'Provider-supplied tags / categories (e.g. ["Remote", "Software Development"])',
    type: [String],
  })
  @IsOptional()
  tags?: string[];
}

/**
 * Body of `POST /job-search/import` — single-job round-trip from a
 * search result back to a persisted JobPosting.
 */
export class ImportUnifiedJobDto {
  @ApiProperty({ description: 'Full job object as returned by /job-search', type: UnifiedJobDto })
  @IsObject()
  @ValidateNested()
  @Type(() => UnifiedJobDto)
  job: UnifiedJobDto;
}

/**
 * Per-source bookkeeping returned alongside merged results so the
 * frontend can show which sources hit, which were skipped, and why.
 */
export class JobSearchSourceStatusDto {
  @ApiProperty({ enum: ['linkedin', 'arbeitnow'] })
  source: JobSourceId;

  @ApiProperty({ description: 'How many results this source contributed' })
  count: number;

  @ApiProperty({ description: 'ok | skipped | error' })
  status: 'ok' | 'skipped' | 'error';

  @ApiPropertyOptional({ description: 'Reason a source was skipped or errored' })
  reason?: string;
}

export class UnifiedJobSearchResponseDto {
  @ApiProperty({ type: [UnifiedJobDto] })
  results: UnifiedJobDto[];

  @ApiProperty({ description: 'Total result count across all sources after dedup' })
  totalCount: number;

  @ApiProperty({ type: [JobSearchSourceStatusDto] })
  sources: JobSearchSourceStatusDto[];

  @ApiProperty({ description: 'When the search executed (ISO 8601)' })
  searchedAt: string;
}
