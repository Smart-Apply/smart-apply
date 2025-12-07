import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * ATS Agent extracted keywords response
 */
export class ATSKeywordsResponseDto {
  @ApiProperty({ description: 'Core competencies (domain-agnostic skills)', type: [String] })
  coreCompetencies: string[];

  @ApiProperty({ description: 'Soft skills extracted', type: [String] })
  softSkills: string[];

  @ApiProperty({ description: 'Responsibility keywords extracted', type: [String] })
  responsibilityKeywords: string[];

  @ApiProperty({ description: 'Requirement keywords extracted', type: [String] })
  requirementKeywords: string[];

  @ApiProperty({ description: 'Methodologies, tools, and frameworks', type: [String] })
  methodologies: string[];

  @ApiProperty({ description: 'Industry-specific keywords', type: [String] })
  industryKeywords: string[];

  @ApiProperty({ description: 'Seniority signals', type: [String] })
  senioritySignals: string[];

  @ApiProperty({ description: 'Miscellaneous keywords', type: [String] })
  miscKeywords: string[];
}

/**
 * Keyword match details
 */
export class KeywordMatchDetailDto {
  @ApiProperty({ description: 'The keyword' })
  keyword: string;

  @ApiProperty({
    description: 'Category of the keyword',
    enum: [
      'core',
      'soft',
      'responsibility',
      'requirement',
      'methodology',
      'industry',
      'seniority',
      'misc',
    ],
  })
  category: string;

  @ApiProperty({ description: 'Whether the keyword was found in profile' })
  found: boolean;

  @ApiPropertyOptional({
    description: 'Where the keyword was used',
    type: [String],
  })
  usedIn?: string[];

  @ApiProperty({ description: 'Confidence score 0-1' })
  confidence: number;
}

/**
 * Category score breakdown
 */
export class CategoryScoreDto {
  @ApiProperty({ description: 'Core competencies match percentage' })
  core: number;

  @ApiProperty({ description: 'Soft skills match percentage' })
  soft: number;

  @ApiProperty({ description: 'Experience match percentage' })
  experience: number;

  @ApiProperty({ description: 'Industry match percentage' })
  industry: number;
}

/**
 * Full match analysis response
 */
export class MatchAnalysisDto {
  @ApiProperty({ description: 'Overall match score 0-100' })
  overallScore: number;

  @ApiProperty({ description: 'Category breakdown scores', type: CategoryScoreDto })
  categoryScores: CategoryScoreDto;

  @ApiProperty({ description: 'Improvement suggestions', type: [String] })
  suggestions: string[];

  @ApiProperty({ description: 'Profile strengths', type: [String] })
  strengths: string[];

  @ApiProperty({ description: 'Profile weaknesses', type: [String] })
  weaknesses: string[];
}

/**
 * Application keywords analysis response
 */
export class ApplicationKeywordsResponseDto {
  @ApiProperty({ description: 'Application ID' })
  applicationId: string;

  @ApiProperty({ description: 'Extracted keywords from job posting', type: ATSKeywordsResponseDto })
  keywords: ATSKeywordsResponseDto;

  @ApiProperty({ description: 'Match analysis', type: MatchAnalysisDto })
  matchAnalysis: MatchAnalysisDto;

  @ApiProperty({ description: 'Matched keywords with details', type: [KeywordMatchDetailDto] })
  matchedKeywords: KeywordMatchDetailDto[];

  @ApiProperty({ description: 'Missing keywords with details', type: [KeywordMatchDetailDto] })
  missingKeywords: KeywordMatchDetailDto[];

  @ApiProperty({ description: 'When the analysis was performed' })
  analyzedAt: Date;
}

/**
 * Pipeline status DTO for SSE
 */
export class PipelineStatusDto {
  @ApiProperty({
    description: 'Current stage of the pipeline',
    enum: [
      'pending',
      'extracting-keywords',
      'generating-cv',
      'generating-cl',
      'finalizing',
      'complete',
      'failed',
    ],
  })
  stage: string;

  @ApiProperty({ description: 'Progress percentage 0-100' })
  progress: number;

  @ApiProperty({ description: 'Status message' })
  message: string;

  @ApiProperty({ description: 'Timestamp' })
  timestamp: Date;

  @ApiPropertyOptional({ description: 'Error message if failed' })
  error?: string;
}
