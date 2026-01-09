import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsIn, IsArray } from 'class-validator';
import { SUPPORTED_LANGUAGES, SupportedLanguage } from '../utils/translation.util';

/**
 * DTO for translate application endpoint
 */
export class TranslateApplicationDto {
  @ApiProperty({
    description: 'Target language code (ISO 639-1)',
    example: 'en',
    enum: ['de', 'en', 'fr', 'es', 'it'],
  })
  @IsString()
  @IsIn(SUPPORTED_LANGUAGES)
  targetLanguage: SupportedLanguage;

  @ApiPropertyOptional({
    description: 'Force translation even if cache exists (bypass cache)',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  force?: boolean;

  @ApiPropertyOptional({
    description:
      'Specific sections to translate (for partial translation). If omitted, all sections are translated.',
    example: ['summary', 'experience.0', 'coverLetter'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sections?: string[];
}

/**
 * Response DTO for translate application endpoint
 */
export class TranslateApplicationResponseDto {
  @ApiProperty({
    description: 'Translated resume data (JSON)',
  })
  resumeText: any;

  @ApiProperty({
    description: 'Translated cover letter HTML',
  })
  coverLetterText: string;

  @ApiProperty({
    description: 'Whether the response was served from cache',
  })
  cached: boolean;

  @ApiProperty({
    description: 'List of sections that were translated (empty if cached)',
    example: ['summary', 'experience.0', 'coverLetter'],
  })
  translatedSections: string[];

  @ApiProperty({
    description: 'List of sections that were loaded from cache',
    example: ['experience.1', 'project.0'],
  })
  fromCache: string[];

  @ApiProperty({
    description: 'Source language of the content',
    example: 'de',
  })
  sourceLanguage: string;

  @ApiProperty({
    description: 'Target language of the translation',
    example: 'en',
  })
  targetLanguage: string;
}

/**
 * Response DTO for cache status query
 */
export class CacheStatusResponseDto {
  @ApiProperty({
    description: 'List of language codes with valid cached translations',
    example: ['de', 'en'],
  })
  cachedLanguages: string[];

  @ApiProperty({
    description: 'Current content hash for cache validation',
  })
  contentHash: string;

  @ApiProperty({
    description: 'Source language of the current content',
    example: 'de',
  })
  sourceLanguage: string;
}
