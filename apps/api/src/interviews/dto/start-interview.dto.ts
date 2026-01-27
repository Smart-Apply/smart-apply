import { IsString, IsEnum, IsOptional, IsInt, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { InterviewType, InterviewDifficulty } from '../../generated/prisma/client';

/**
 * DTO for starting a new interview session
 */
export class StartInterviewDto {
  @ApiPropertyOptional({
    description: 'Application ID to base the interview on (for context)',
    example: 'cmku5ebra000vffy1byj2ahog',
  })
  @IsOptional()
  @IsString()
  applicationId?: string;

  @ApiPropertyOptional({
    enum: InterviewType,
    description: 'Type of interview',
    default: InterviewType.MIXED,
  })
  @IsOptional()
  @IsEnum(InterviewType)
  type?: InterviewType;

  @ApiPropertyOptional({
    description: 'Industry for domain-specific questions',
    example: 'IT',
  })
  @IsOptional()
  @IsString()
  industry?: string;

  @ApiPropertyOptional({
    enum: InterviewDifficulty,
    description: 'Interview difficulty level',
    default: InterviewDifficulty.MEDIUM,
  })
  @IsOptional()
  @IsEnum(InterviewDifficulty)
  difficulty?: InterviewDifficulty;

  @ApiPropertyOptional({
    description: 'Interview language (ISO 639-1)',
    example: 'de',
    default: 'de',
  })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional({
    description: 'Target job title (if not using application)',
    example: 'Senior Software Engineer',
  })
  @IsOptional()
  @IsString()
  jobTitle?: string;

  @ApiPropertyOptional({
    description: 'Target company name (if not using application)',
    example: 'Google',
  })
  @IsOptional()
  @IsString()
  company?: string;

  @ApiPropertyOptional({
    description: 'Job description text (if not using application)',
    example: 'We are looking for a Senior Software Engineer...',
  })
  @IsOptional()
  @IsString()
  jobDescription?: string;

  @ApiPropertyOptional({
    description: 'Maximum number of questions',
    default: 10,
    minimum: 3,
    maximum: 20,
  })
  @IsOptional()
  @IsInt()
  @Min(3)
  @Max(20)
  maxQuestions?: number;

  @ApiPropertyOptional({
    description: 'Time limit per question in minutes',
    minimum: 1,
    maximum: 10,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  timeLimitMinutes?: number;
}
