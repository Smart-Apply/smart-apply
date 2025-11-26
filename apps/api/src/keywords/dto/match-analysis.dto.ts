import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Represents a single keyword match in the analysis
 */
export class KeywordMatchDto {
  @ApiProperty({ description: 'The keyword text' })
  keyword: string;

  @ApiProperty({
    description: 'Category of the keyword',
    enum: ['technical', 'soft', 'experience', 'industry', 'methodology', 'education', 'certification'],
  })
  category: 'technical' | 'soft' | 'experience' | 'industry' | 'methodology' | 'education' | 'certification';

  @ApiProperty({ description: 'Whether the keyword was found in the profile' })
  found: boolean;

  @ApiProperty({ description: 'Confidence score from 0 to 1', minimum: 0, maximum: 1 })
  confidence: number;

  @ApiPropertyOptional({
    description: 'Locations where the keyword was found in the profile',
    type: [String],
  })
  locations?: string[];

  @ApiPropertyOptional({ description: 'Frequency of keyword occurrence in job posting' })
  frequency?: number;
}

/**
 * Complete match analysis result
 */
export class MatchAnalysisResponseDto {
  @ApiProperty({ description: 'Overall match percentage from 0 to 100', minimum: 0, maximum: 100 })
  matchPercentage: number;

  @ApiProperty({ description: 'Keywords found in both job posting and profile', type: [KeywordMatchDto] })
  matchedKeywords: KeywordMatchDto[];

  @ApiProperty({ description: 'Keywords in job posting but not in profile', type: [KeywordMatchDto] })
  missingKeywords: KeywordMatchDto[];

  @ApiProperty({ description: 'Suggestions to improve profile match', type: [String] })
  suggestions: string[];

  @ApiProperty({ description: 'Profile strengths for this job posting', type: [String] })
  strengths: string[];

  @ApiProperty({ description: 'Profile weaknesses for this job posting', type: [String] })
  weaknesses: string[];

  @ApiProperty({ description: 'Breakdown of match by category' })
  categoryBreakdown: {
    technical: { matched: number; total: number; percentage: number };
    soft: { matched: number; total: number; percentage: number };
    experience: { matched: number; total: number; percentage: number };
    other: { matched: number; total: number; percentage: number };
  };
}

/**
 * Extracted keywords from a job posting
 */
export class ExtractedKeywordsDto {
  @ApiProperty({ description: 'Technical skills extracted', type: [String] })
  technical: string[];

  @ApiProperty({ description: 'Soft skills extracted', type: [String] })
  soft: string[];

  @ApiProperty({ description: 'Experience level keywords', type: [String] })
  experience: string[];

  @ApiProperty({ description: 'Industry-specific keywords', type: [String] })
  industry: string[];

  @ApiProperty({ description: 'Methodology keywords (Agile, Scrum, etc.)', type: [String] })
  methodology: string[];

  @ApiProperty({ description: 'Education requirements', type: [String] })
  education: string[];

  @ApiProperty({ description: 'Certification requirements', type: [String] })
  certifications: string[];
}
