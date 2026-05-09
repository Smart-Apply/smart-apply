import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { Sanitize } from '../common/decorators/sanitize.decorator';
import { SearchLinkedInJobsDto } from '../linkedin-jobs/dto/search-linkedin-jobs.dto';

/**
 * Cron expressions allowed for the recommendation schedule. Restrict to a
 * small allowlist so users can't accidentally schedule "every minute" and
 * blow through Apify quota in 60 seconds.
 *
 * Format: standard 5-field cron. Stored as raw string in `AutoApplyConfig.cronSchedule`.
 */
const ALLOWED_CRON_PATTERN =
  /^(0|0 \*\/\d{1,2}|0 \d{1,2}|\d{1,2} \d{1,2}) (\*|\*\/\d{1,2}|\d{1,2}) (\*|\*\/\d{1,2}|\d{1,2}) (\*|\d{1,2}) (\*|\d{1,2})$/;

/**
 * Payload to create or update the user's single AutoApplyConfig row.
 */
export class UpsertAutoApplyConfigDto {
  @ApiPropertyOptional({
    description: 'Whether the agent should run on its schedule',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;

  @ApiProperty({
    description: 'LinkedIn search filters (same shape as POST /linkedin-jobs/search)',
    type: SearchLinkedInJobsDto,
  })
  @IsObject()
  @ValidateNested()
  @Type(() => SearchLinkedInJobsDto)
  searchFilters!: SearchLinkedInJobsDto;

  @ApiPropertyOptional({
    description: 'Maximum new suggestions to surface per cron run',
    minimum: 1,
    maximum: 20,
    default: 5,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  maxSuggestionsPerDay?: number = 5;

  @ApiPropertyOptional({
    description: 'Suggestions below this match score (0-100) are skipped',
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  minAtsScore?: number;

  @ApiPropertyOptional({
    description: 'Job description must contain ALL of these keywords (case-insensitive)',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  @Sanitize()
  requiredKeywords?: string[];

  @ApiPropertyOptional({
    description: 'Postings from these companies are never surfaced',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  @Sanitize()
  blockedCompanies?: string[];

  @ApiPropertyOptional({
    description: 'Cron expression (restricted to a safe subset)',
    example: '0 9 * * *',
    default: '0 9 * * *',
  })
  @IsOptional()
  @IsString()
  @Matches(ALLOWED_CRON_PATTERN, {
    message:
      'cronSchedule must be a safe 5-field cron expression (e.g. "0 9 * * *"). Sub-minute / "* * * * *" patterns are rejected.',
  })
  cronSchedule?: string = '0 9 * * *';

  @ApiPropertyOptional({
    description: 'Send a daily digest email summarising new suggestions',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  digestEnabled?: boolean = true;

  @ApiPropertyOptional({
    description:
      'Resume template id to use when approving a suggestion. Null/omitted = backend auto-picks the language-matched default.',
    example: 'professional-resume',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  cvTemplateId?: string;

  @ApiPropertyOptional({
    description:
      'Cover-letter template id to use when approving a suggestion. Ignored when generateCoverLetter=false.',
    example: 'professional-cover-letter',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  clTemplateId?: string;

  @ApiPropertyOptional({
    description:
      'Whether to generate an Anschreiben (cover letter) when the user approves a suggestion. False = resume only.',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  generateCoverLetter?: boolean = true;
}

/**
 * Compact representation of one suggestion for the inbox list view.
 */
export class AutoApplySuggestionDto {
  @ApiProperty() id!: string;
  @ApiProperty() externalJobId!: string;
  @ApiProperty() jobTitle!: string;
  @ApiProperty() company!: string;
  @ApiPropertyOptional() location?: string;
  @ApiProperty() jobUrl!: string;
  @ApiPropertyOptional() postedAt?: string;
  @ApiPropertyOptional() matchScore?: number;
  @ApiPropertyOptional() matchReasons?: Record<string, unknown>;
  @ApiProperty({ enum: ['PENDING', 'APPROVED', 'SKIPPED', 'BLOCKED', 'EXPIRED'] })
  status!: 'PENDING' | 'APPROVED' | 'SKIPPED' | 'BLOCKED' | 'EXPIRED';
  @ApiPropertyOptional() decidedAt?: string;
  @ApiPropertyOptional() applicationId?: string;
  @ApiProperty() createdAt!: string;
}

export class AutoApplyConfigDto {
  @ApiProperty() id!: string;
  @ApiProperty() isActive!: boolean;
  @ApiProperty() searchFilters!: Record<string, unknown>;
  @ApiProperty() maxSuggestionsPerDay!: number;
  @ApiPropertyOptional() minAtsScore?: number;
  @ApiProperty({ type: [String] }) requiredKeywords!: string[];
  @ApiProperty({ type: [String] }) blockedCompanies!: string[];
  @ApiProperty() cronSchedule!: string;
  @ApiProperty() digestEnabled!: boolean;
  @ApiPropertyOptional() cvTemplateId?: string;
  @ApiPropertyOptional() clTemplateId?: string;
  @ApiProperty() generateCoverLetter!: boolean;
  @ApiPropertyOptional() lastRunAt?: string;
  @ApiPropertyOptional() nextRunAt?: string;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}

export class ApproveSuggestionResponseDto {
  @ApiProperty({ description: 'Newly created Application id' })
  applicationId!: string;
}
