import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Sanitize } from '../../common/decorators/sanitize.decorator';

export enum LinkedInExperienceLevel {
  Internship = '1',
  EntryLevel = '2',
  Associate = '3',
  MidSenior = '4',
  Director = '5',
  Executive = '6',
}

export enum LinkedInJobType {
  FullTime = 'F',
  PartTime = 'P',
  Contract = 'C',
  Temporary = 'T',
  Internship = 'I',
  Volunteer = 'V',
  Other = 'O',
}

export enum LinkedInRemoteFilter {
  OnSite = '1',
  Remote = '2',
  Hybrid = '3',
}

export enum LinkedInDatePosted {
  PastDay = 'r86400',
  PastWeek = 'r604800',
  PastMonth = 'r2592000',
}

export enum LinkedInSortBy {
  MostRelevant = 'R',
  MostRecent = 'DD',
}

/**
 * ISO-like 2-letter codes for the most common country scopes the user
 * might want. We map these to LinkedIn `geoId`s server-side so a search
 * for "NRW" doesn't fall back to a worldwide LinkedIn search and return
 * jobs in Azerbaijan.
 */
export enum LinkedInCountry {
  Germany = 'de',
  Austria = 'at',
  Switzerland = 'ch',
  UnitedKingdom = 'gb',
  UnitedStates = 'us',
  Netherlands = 'nl',
  France = 'fr',
  Spain = 'es',
  Italy = 'it',
  Worldwide = 'ww',
}

/**
 * Filters for LinkedIn job search via Apify scraper.
 *
 * The actor (`curious_coder/linkedin-jobs-scraper`) accepts LinkedIn search
 * URLs as input. We build the URL from these filter fields server-side so
 * the frontend never has to know the LinkedIn URL conventions.
 */
export class SearchLinkedInJobsDto {
  @ApiPropertyOptional({
    description: 'Search keywords (job title, skills, company)',
    maxLength: 200,
    example: 'Senior Frontend Developer',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Sanitize()
  keywords?: string;

  @ApiPropertyOptional({
    description: 'Location name (city, region, country)',
    maxLength: 200,
    example: 'Berlin, Germany',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Sanitize()
  location?: string;

  @ApiPropertyOptional({
    description:
      'LinkedIn geoId (numeric region/city ID). When provided, takes precedence over location & country.',
    maxLength: 20,
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  geoId?: string;

  @ApiPropertyOptional({
    description:
      'Country scope for the search. Used to anchor the LinkedIn geoId when no explicit geoId is provided. Defaults to Germany.',
    enum: LinkedInCountry,
    default: LinkedInCountry.Germany,
  })
  @IsOptional()
  @IsEnum(LinkedInCountry)
  country?: LinkedInCountry;

  @ApiPropertyOptional({
    description: 'Experience level filter (multi-select)',
    enum: LinkedInExperienceLevel,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(LinkedInExperienceLevel, { each: true })
  experienceLevel?: LinkedInExperienceLevel[];

  @ApiPropertyOptional({
    description: 'Employment type filter (multi-select)',
    enum: LinkedInJobType,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(LinkedInJobType, { each: true })
  jobType?: LinkedInJobType[];

  @ApiPropertyOptional({
    description: 'Work-mode filter: 1=on-site, 2=remote, 3=hybrid (multi-select)',
    enum: LinkedInRemoteFilter,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(LinkedInRemoteFilter, { each: true })
  remote?: LinkedInRemoteFilter[];

  @ApiPropertyOptional({
    description: 'How recently the job was posted',
    enum: LinkedInDatePosted,
  })
  @IsOptional()
  @IsEnum(LinkedInDatePosted)
  datePosted?: LinkedInDatePosted;

  @ApiPropertyOptional({
    description: 'Sort order: R = most relevant, DD = most recent',
    enum: LinkedInSortBy,
    default: LinkedInSortBy.MostRecent,
  })
  @IsOptional()
  @IsEnum(LinkedInSortBy)
  sortBy?: LinkedInSortBy;

  @ApiPropertyOptional({
    description: 'Only show Easy Apply jobs',
  })
  @IsOptional()
  @IsBoolean()
  easyApply?: boolean;

  @ApiPropertyOptional({
    description: 'Maximum number of results (1–250). Defaults to 25.',
    minimum: 1,
    maximum: 250,
    default: 25,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(250)
  count?: number;
}
