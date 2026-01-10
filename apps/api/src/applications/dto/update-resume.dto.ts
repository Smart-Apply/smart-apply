import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';

class SkillCategoryDto {
  @ApiPropertyOptional({ example: 'skill-cat-123' })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({ example: 'Frameworks' })
  @IsString()
  type: string;

  @ApiProperty({ type: [String], example: ['NestJS', 'Next.js', 'React'] })
  @IsArray()
  @IsString({ each: true })
  skills: string[];
}

class ExperienceEntryDto {
  @ApiPropertyOptional({ example: 'exp-123' })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({ example: 'Senior Software Engineer' })
  @IsString()
  title: string;

  @ApiProperty({ example: 'Smart Apply GmbH' })
  @IsString()
  company: string;

  @ApiPropertyOptional({ example: 'Remote' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiProperty({ example: 'Jan 2023 – Heute' })
  @IsString()
  dateRange: string;

  @ApiPropertyOptional({ example: '2023-01-15' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2024-12-31' })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({ example: 'Verantwortlich für die Entwicklung von Cloud-Lösungen...' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ type: [String], example: ['Führte Cloud-Migration durch'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  achievements?: string[];
}

class ProjectEntryDto {
  @ApiPropertyOptional({ example: 'proj-123' })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({ example: 'Automatisierter Lebenslauf-Generator' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Generiert Dokumente mit KI' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: '2024' })
  @IsOptional()
  @IsString()
  date?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  highlights?: string[];
}

class EducationEntryDto {
  @ApiPropertyOptional({ example: 'edu-123' })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({ example: 'B.Sc. Wirtschaftsinformatik' })
  @IsString()
  degree: string;

  @ApiProperty({ example: 'Universität Duisburg-Essen' })
  @IsString()
  institution: string;

  @ApiProperty({ example: '2019 – 2023' })
  @IsString()
  year: string;

  @ApiPropertyOptional({ example: 'Informatik' })
  @IsOptional()
  @IsString()
  fieldOfStudy?: string;

  @ApiPropertyOptional({ example: '1.3' })
  @IsOptional()
  @IsString()
  gpa?: string;

  @ApiPropertyOptional({ example: 'Schwerpunkt KI' })
  @IsOptional()
  @IsString()
  description?: string;
}

class CertificationEntryDto {
  @ApiPropertyOptional({ example: 'cert-123' })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({ example: 'Microsoft Azure Architect Expert' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'Microsoft' })
  @IsString()
  issuer: string;

  @ApiPropertyOptional({ example: 'Apr 2024' })
  @IsOptional()
  @IsString()
  date?: string;
}

class LanguageEntryDto {
  @ApiProperty({ example: 'Deutsch' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Muttersprache' })
  @IsOptional()
  @IsString()
  level?: string;
}

class ResumeTemplateDto {
  @ApiProperty({ example: 'Arianit Sheholli' })
  @IsString()
  candidateName: string;

  @ApiProperty({ example: 'arianit@example.com' })
  @IsString()
  email: string;

  @ApiPropertyOptional({ example: '+49 123 456 789' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'Duisburg, Deutschland' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ example: 'https://linkedin.com/in/arianit' })
  @IsOptional()
  @IsString()
  linkedin?: string;

  @ApiPropertyOptional({ example: 'https://github.com/arianit' })
  @IsOptional()
  @IsString()
  github?: string;

  @ApiPropertyOptional({ example: 'Cloud Solution Architect mit Fokus auf Azure.' })
  @IsOptional()
  @IsString()
  summary?: string;

  @ApiProperty({ type: [SkillCategoryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SkillCategoryDto)
  skillCategories: SkillCategoryDto[];

  @ApiProperty({ type: [ExperienceEntryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExperienceEntryDto)
  experiences: ExperienceEntryDto[];

  @ApiPropertyOptional({ type: [ProjectEntryDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProjectEntryDto)
  projects?: ProjectEntryDto[];

  @ApiPropertyOptional({ type: [EducationEntryDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EducationEntryDto)
  education?: EducationEntryDto[];

  @ApiPropertyOptional({ type: [CertificationEntryDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CertificationEntryDto)
  certifications?: CertificationEntryDto[];

  @ApiPropertyOptional({ type: [LanguageEntryDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LanguageEntryDto)
  languages?: LanguageEntryDto[];

  @ApiPropertyOptional({ example: 'de', description: 'Language code for the resume (de or en)' })
  @IsOptional()
  @IsString()
  language?: string;
}

export class UpdateResumeDto {
  @ApiProperty({ type: ResumeTemplateDto })
  @ValidateNested()
  @Type(() => ResumeTemplateDto)
  resume: ResumeTemplateDto;

  @ApiPropertyOptional({
    example: 'en',
    description:
      'The language the content is currently in (ISO 639-1). Used to track content language when user edits in a translated view.',
  })
  @IsOptional()
  @IsString()
  contentLanguage?: string;
}
