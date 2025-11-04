import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ApplicationStatus {
  PENDING = 'PENDING',
  GENERATING = 'GENERATING',
  READY = 'READY',
  FAILED = 'FAILED',
}

export class ApplicationResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  userId: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440002' })
  jobPostingId: string;

  @ApiProperty({ enum: ApplicationStatus, example: ApplicationStatus.READY })
  status: ApplicationStatus;

  @ApiPropertyOptional({ example: 'Kontakt über Networking Event' })
  notes?: string;

  @ApiPropertyOptional({
    example: 'Dear Hiring Manager, I am writing to express...',
  })
  coverLetterText?: string;

  @ApiPropertyOptional({
    example: '# John Doe\n\n## Experience\n\n...',
  })
  resumeText?: string;

  @ApiPropertyOptional({ example: 'applications/app-123-cover-letter.pdf' })
  coverLetterFileKey?: string;

  @ApiPropertyOptional({ example: 'applications/app-123-resume.pdf' })
  resumeFileKey?: string;

  @ApiPropertyOptional({ example: 'LLM service unavailable' })
  errorMessage?: string;

  @ApiProperty({ example: '2024-01-15T10:30:00Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-01-15T10:32:00Z' })
  updatedAt: Date;

  @ApiPropertyOptional({
    description: 'Job Posting Details (falls include=jobPosting)',
  })
  jobPosting?: {
    id: string;
    title: string;
    company: string;
    location?: string;
    description?: string;
  };
}
