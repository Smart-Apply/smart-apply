import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
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

/**
 * Single LinkedIn job result.
 * Returned by /linkedin-jobs/search and consumed by /linkedin-jobs/import.
 */
export class LinkedInJobDto {
  @ApiProperty({ description: 'LinkedIn job posting ID' })
  @IsString()
  @MaxLength(64)
  id: string;

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

  @ApiPropertyOptional({ description: 'Company LinkedIn URL' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  companyUrl?: string;

  @ApiPropertyOptional({ description: 'Company logo URL' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  companyLogoUrl?: string;

  @ApiPropertyOptional({ description: 'Job location' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  @Sanitize()
  location?: string;

  @ApiPropertyOptional({ description: 'Work mode (remote/hybrid/on-site)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  workType?: string;

  @ApiPropertyOptional({ description: 'Employment type' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  employmentType?: string;

  @ApiPropertyOptional({ description: 'Seniority / experience level' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  seniority?: string;

  @ApiPropertyOptional({ description: 'Posted-at timestamp (ISO 8601)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  postedAt?: string;

  @ApiPropertyOptional({ description: 'Number of applicants' })
  @IsOptional()
  // Tolerate the heterogeneous shapes the Apify actor produces:
  // numbers, "200+", "Über 100", floats, negatives, etc. Coerce to a
  // non-negative integer or strip the field. The producer-side
  // (LinkedInJobsService.normalizeApplicantsCount) already does this,
  // but we re-apply here so old cached search results that the browser
  // re-sends to /import don't fail validation.
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

  @ApiProperty({ description: 'Public LinkedIn URL of the posting' })
  @IsUrl({ require_tld: true })
  @MaxLength(500)
  url: string;

  @ApiPropertyOptional({
    description: 'Plain-text description (HTML stripped)',
  })
  @IsOptional()
  @IsString()
  @Sanitize()
  description?: string;
}

export class ImportLinkedInJobDto {
  @ApiProperty({
    description: 'Full LinkedIn job object as returned by /linkedin-jobs/search',
    type: LinkedInJobDto,
  })
  @IsObject()
  @ValidateNested()
  @Type(() => LinkedInJobDto)
  job: LinkedInJobDto;
}

export class LinkedInJobSearchResponseDto {
  @ApiProperty({ type: [LinkedInJobDto] })
  results: LinkedInJobDto[];

  @ApiProperty({ description: 'Total number of results returned' })
  totalCount: number;

  @ApiProperty({ description: 'When the search executed (ISO 8601)' })
  searchedAt: string;

  @ApiProperty({ description: 'Echo of the filters used for the search' })
  filters: Record<string, unknown>;
}
