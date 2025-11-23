import { IsString, IsOptional, IsUrl, MaxLength, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Sanitize } from '../../common/decorators/sanitize.decorator';

export class CreateJobPostingDto {
  @ApiProperty({ description: 'Job title', maxLength: 200 })
  @IsString()
  @MaxLength(200)
  @Sanitize()
  title: string;

  @ApiProperty({ description: 'Company name', maxLength: 200 })
  @IsString()
  @MaxLength(200)
  @Sanitize()
  company: string;

  @ApiPropertyOptional({ description: 'Job location', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Sanitize()
  location?: string;

  @ApiPropertyOptional({ description: 'Job posting URL' })
  @IsOptional()
  @IsUrl()
  url?: string;

  @ApiProperty({ description: 'Full job description' })
  @IsString()
  @Sanitize()
  description: string;

  @ApiPropertyOptional({ description: 'Job requirements (one per line or as array)', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requirements?: string[];

  @ApiPropertyOptional({ description: 'Job responsibilities (one per line or as array)', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  responsibilities?: string[];

  @ApiPropertyOptional({ description: 'Nice to have qualifications (one per line or as array)', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  niceToHave?: string[];

  @ApiPropertyOptional({ description: 'Salary range', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Sanitize()
  salary?: string;

  @ApiPropertyOptional({ description: 'Employment type (e.g., Full-time, Part-time, Contract)', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Sanitize()
  employmentType?: string;
}
