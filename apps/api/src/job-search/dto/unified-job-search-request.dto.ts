import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Sanitize } from '../../common/decorators/sanitize.decorator';
import { LinkedInCountry } from '../../linkedin-jobs/dto/search-linkedin-jobs.dto';
import type { JobSourceId } from '../job-search-provider.interface';

const ALL_SOURCES: JobSourceId[] = ['linkedin', 'arbeitnow'];

/**
 * Provider-agnostic search request.
 *
 * The unified endpoint translates these fields to each provider's native
 * shape (LinkedIn URL params, Arbeitnow `?search=` query, …). Filters
 * that don't map to a given provider are silently ignored — the source
 * status block in the response tells the caller which filters
 * actually applied.
 */
export class UnifiedJobSearchRequestDto {
  @ApiPropertyOptional({
    description: 'Free-text keywords (job title, skills, company)',
    maxLength: 200,
    example: 'Werkstudent Wirtschaftsinformatik',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Sanitize()
  keywords?: string;

  @ApiPropertyOptional({
    description: 'Location (city, region, country). Used by LinkedIn for geoId resolution.',
    maxLength: 200,
    example: 'Berlin',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Sanitize()
  location?: string;

  @ApiPropertyOptional({
    description: 'Country scope (LinkedIn only). Defaults to Germany.',
    enum: LinkedInCountry,
    default: LinkedInCountry.Germany,
  })
  @IsOptional()
  @IsEnum(LinkedInCountry)
  country?: LinkedInCountry;

  @ApiPropertyOptional({
    description: 'Restrict to jobs flagged as remote (currently honored by Arbeitnow only).',
  })
  @IsOptional()
  @IsBoolean()
  remoteOnly?: boolean;

  @ApiPropertyOptional({
    description:
      'Sources to query. Omit or pass an empty array to fan out across all configured providers. Order of results is dictated by the per-source ranking (no global re-ranking yet).',
    isArray: true,
    enum: ALL_SOURCES,
    default: ALL_SOURCES,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(ALL_SOURCES.length)
  @IsIn(ALL_SOURCES, { each: true })
  sources?: JobSourceId[];

  @ApiPropertyOptional({
    description: 'Maximum results PER SOURCE (1–100). Defaults to 25.',
    minimum: 1,
    maximum: 100,
    default: 25,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  perSourceLimit?: number;
}
