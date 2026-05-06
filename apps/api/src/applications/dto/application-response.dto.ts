import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// PDF Generation Status (system-facing)
export enum ApplicationStatus {
  PENDING = 'PENDING',
  GENERATING = 'GENERATING',
  READY = 'READY',
  FAILED = 'FAILED',
}

// Application Tracking Status (user-facing)
export enum ApplicationTrackingStatus {
  APPLIED = 'APPLIED',
  INTERVIEW = 'INTERVIEW',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
}

// Who/what last changed Application.applicationStatus.
// Drives the "📧 detected by inbox tracking" pill in the UI and the
// notification-mail gate in the orchestrator.
export enum ApplicationStatusSource {
  SYSTEM = 'SYSTEM',
  USER = 'USER',
  EMAIL_TRACKING = 'EMAIL_TRACKING',
}

export class ApplicationResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  userId: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440002' })
  jobPostingId: string;

  @ApiPropertyOptional({
    example: 'Senior Frontend Developer @ Google',
    description: 'Custom application title (LLM-generated, user editable)',
  })
  title?: string;

  @ApiPropertyOptional({
    example: 'Senior Software Engineer',
    description: 'Target job title displayed on CV/Cover Letter (defaults to job posting title)',
  })
  targetJobTitle?: string;

  @ApiProperty({
    enum: ApplicationTrackingStatus,
    example: ApplicationTrackingStatus.APPLIED,
    description: 'User-facing application tracking status',
  })
  applicationStatus: ApplicationTrackingStatus;

  @ApiPropertyOptional({
    example: '2024-01-15T10:35:00Z',
    description: 'Timestamp when application status was last updated',
  })
  statusUpdatedAt?: Date;

  @ApiPropertyOptional({
    enum: ApplicationStatusSource,
    example: ApplicationStatusSource.USER,
    description:
      'Who/what last changed `applicationStatus`. EMAIL_TRACKING means the inbox-sync agent detected the change in an incoming mail.',
  })
  statusSource?: ApplicationStatusSource;

  @ApiProperty({
    enum: ApplicationStatus,
    example: ApplicationStatus.READY,
    description: 'System-facing PDF generation status',
  })
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

  @ApiPropertyOptional({
    example: 'professional-cover-letter',
    description: 'ID of the selected cover letter template',
  })
  coverLetterTemplateId?: string;

  @ApiPropertyOptional({
    example: 'modern-resume',
    description: 'ID of the selected resume template',
  })
  resumeTemplateId?: string;

  @ApiPropertyOptional({
    example: 'de',
    description: 'Language for generated content (ISO 639-1 code)',
    enum: ['de', 'en', 'fr', 'es', 'it'],
  })
  language?: string;

  @ApiProperty({ example: '2024-01-15T10:30:00Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-01-15T10:32:00Z' })
  updatedAt: Date;

  @ApiPropertyOptional({
    description: 'ATS keywords extracted from job posting and profile (max 20)',
    example: {
      hard_skills: [
        { keyword: 'React', source: 'both', priority: 1 },
        { keyword: 'TypeScript', source: 'job', priority: 1 },
      ],
      tools_and_tech: [{ keyword: 'Docker', source: 'both', priority: 2 }],
      domains: [{ keyword: 'Web Development', source: 'both', priority: 1 }],
      methodologies: [{ keyword: 'Agile', source: 'job', priority: 2 }],
    },
  })
  atsKeywords?: {
    hard_skills: Array<{ keyword: string; source: string; priority: number }>;
    tools_and_tech: Array<{
      keyword: string;
      source: string;
      priority: number;
    }>;
    domains: Array<{ keyword: string; source: string; priority: number }>;
    methodologies: Array<{
      keyword: string;
      source: string;
      priority: number;
    }>;
  };

  @ApiPropertyOptional({
    description: 'Tailored profile data (selected skills/experiences relevant to this job)',
    example: {
      target_role: 'Full-Stack Developer',
      target_company: 'Acme Corp',
      reasoning_short: 'Candidate has strong React and Node.js experience',
      selected_hard_skills: ['React', 'Node.js', 'TypeScript'],
      selected_soft_skills: ['Communication', 'Problem-solving'],
      selected_experiences: [
        {
          profileExperienceId: 'exp123',
          title: 'Senior Developer',
          company: 'Tech Inc',
          summary: 'Built scalable web apps',
          why_relevant: 'Direct experience with React',
        },
      ],
    },
  })
  tailoredProfile?: any;

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
