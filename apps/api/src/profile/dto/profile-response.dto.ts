import { ApiProperty } from '@nestjs/swagger';
import { SkillLevel, LanguageProficiency } from '../../generated/prisma/client';

export class SkillResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ required: false, enum: SkillLevel })
  level?: SkillLevel | null;
}

export class CertificateResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  issuer: string;

  @ApiProperty({ required: false })
  dateObtained?: string;

  @ApiProperty({ required: false })
  url?: string;
}

export class ExperienceResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  company: string;

  @ApiProperty()
  startDate: string;

  @ApiProperty({ required: false })
  endDate?: string;

  @ApiProperty({ required: false })
  description?: string;
}

export class ProjectResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ required: false })
  description?: string;

  @ApiProperty({ type: [String], required: false })
  technologies?: string[];

  @ApiProperty({ required: false })
  url?: string;
}

export class EducationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  degree: string;

  @ApiProperty()
  institution: string;

  @ApiProperty({ required: false })
  fieldOfStudy?: string;

  @ApiProperty({ required: false })
  startYear?: string;

  @ApiProperty({ required: false })
  endYear?: string;

  @ApiProperty({ required: false })
  gpa?: string;

  @ApiProperty({ required: false })
  description?: string;
}

export class LanguageResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'Deutsch' })
  name: string;

  @ApiProperty({ example: 'NATIVE', enum: LanguageProficiency })
  level: LanguageProficiency | null;
}

export class ProfileResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty({ required: false })
  firstName?: string;

  @ApiProperty({ required: false })
  lastName?: string;

  @ApiProperty({ required: false })
  phone?: string;

  @ApiProperty({ required: false, description: 'Street and house number' })
  street?: string;

  @ApiProperty({ required: false, description: 'Postal code (PLZ)' })
  postalCode?: string;

  @ApiProperty({ required: false, description: 'City name' })
  city?: string;

  @ApiProperty({ required: false, description: 'Country name' })
  country?: string;

  @ApiProperty({ required: false })
  linkedinUrl?: string;

  @ApiProperty({ required: false })
  githubUrl?: string;

  @ApiProperty({ required: false })
  portfolioUrl?: string;

  @ApiProperty({ required: false })
  summary?: string;

  @ApiProperty({ type: [SkillResponseDto] })
  skills: SkillResponseDto[];

  @ApiProperty({ type: [CertificateResponseDto] })
  certificates: CertificateResponseDto[];

  @ApiProperty({ type: [ExperienceResponseDto] })
  experiences: ExperienceResponseDto[];

  @ApiProperty({ type: [ProjectResponseDto] })
  projects: ProjectResponseDto[];

  @ApiProperty({ type: [EducationResponseDto] })
  education: EducationResponseDto[];

  @ApiProperty({ type: [LanguageResponseDto] })
  languages: LanguageResponseDto[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
