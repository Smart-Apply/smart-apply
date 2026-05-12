import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsUrl,
  IsDateString,
  IsBoolean,
  IsPhoneNumber,
  IsEnum,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { Sanitize, SanitizeArray, SanitizeUrl } from '../../common/decorators/sanitize.decorator';
import { SkillLevel, LanguageProficiency } from '../../generated/prisma/client';

/**
 * Maps legacy string skill levels to SkillLevel enum values
 * Supports both English and German input values for backward compatibility
 */
export function mapToSkillLevel(value: string | null | undefined): SkillLevel | null {
  if (!value) return null;
  const normalized = value.toUpperCase().trim();

  // Direct enum match
  if (Object.values(SkillLevel).includes(normalized as SkillLevel)) {
    return normalized as SkillLevel;
  }

  // Legacy string mappings
  const mappings: Record<string, SkillLevel> = {
    EXPERT: SkillLevel.EXPERT,
    EXPERTE: SkillLevel.EXPERT,
    ADVANCED: SkillLevel.ADVANCED,
    FORTGESCHRITTEN: SkillLevel.ADVANCED,
    INTERMEDIATE: SkillLevel.INTERMEDIATE,
    MITTEL: SkillLevel.INTERMEDIATE,
    GUT: SkillLevel.INTERMEDIATE,
    BEGINNER: SkillLevel.BEGINNER,
    ANFÄNGER: SkillLevel.BEGINNER,
    BASIC: SkillLevel.BEGINNER,
  };

  return mappings[normalized] || null;
}

/**
 * Maps legacy string language proficiency levels to LanguageProficiency enum values
 * Supports both English and German input values for backward compatibility
 */
export function mapToLanguageProficiency(
  value: string | null | undefined,
): LanguageProficiency | null {
  if (!value) return null;
  const normalized = value.toUpperCase().trim();

  // Direct enum match
  if (Object.values(LanguageProficiency).includes(normalized as LanguageProficiency)) {
    return normalized as LanguageProficiency;
  }

  // Legacy string mappings
  const mappings: Record<string, LanguageProficiency> = {
    NATIVE: LanguageProficiency.NATIVE,
    MUTTERSPRACHE: LanguageProficiency.NATIVE,
    FLUENT: LanguageProficiency.FLUENT,
    FLIESSEND: LanguageProficiency.FLUENT,
    FLIEßEND: LanguageProficiency.FLUENT,
    ADVANCED: LanguageProficiency.ADVANCED,
    FORTGESCHRITTEN: LanguageProficiency.ADVANCED,
    INTERMEDIATE: LanguageProficiency.INTERMEDIATE,
    GUT: LanguageProficiency.INTERMEDIATE,
    MITTEL: LanguageProficiency.INTERMEDIATE,
    BASIC: LanguageProficiency.BASIC,
    GRUNDKENNTNISSE: LanguageProficiency.BASIC,
    ANFÄNGER: LanguageProficiency.BASIC,
  };

  return mappings[normalized] || LanguageProficiency.INTERMEDIATE; // Default fallback
}

export class SkillDto {
  @ApiProperty({
    example: 'clx1234567890',
    required: false,
    description: 'If provided, updates existing skill; otherwise creates new one',
  })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({ example: 'TypeScript' })
  @Sanitize()
  @IsString()
  name: string;

  @ApiProperty({
    example: 'EXPERT',
    required: false,
    enum: SkillLevel,
    description: 'Skill proficiency level (BEGINNER, INTERMEDIATE, ADVANCED, EXPERT)',
  })
  @IsOptional()
  @Transform(({ value }) => mapToSkillLevel(value))
  level?: SkillLevel | null;
}

export class CertificateDto {
  @ApiProperty({
    example: 'clx1234567890',
    required: false,
    description: 'If provided, updates existing certificate; otherwise creates new one',
  })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({ example: 'AWS Certified Solutions Architect' })
  @Sanitize()
  @IsString()
  name: string;

  @ApiProperty({ example: 'Amazon Web Services' })
  @Sanitize()
  @IsString()
  issuer: string;

  @ApiProperty({ example: '2023-05-15', required: false })
  @IsOptional()
  @IsDateString()
  dateObtained?: string;

  @ApiProperty({ example: 'https://example.com/cert.pdf', required: false })
  @IsOptional()
  @SanitizeUrl()
  @IsUrl()
  url?: string;
}

export class ExperienceDto {
  @ApiProperty({
    example: 'clx1234567890',
    required: false,
    description: 'If provided, updates existing experience; otherwise creates new one',
  })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({ example: 'Senior Software Engineer' })
  @Sanitize()
  @IsString()
  title: string;

  @ApiProperty({ example: 'TechCorp Inc.' })
  @Sanitize()
  @IsString()
  company: string;

  @ApiProperty({ example: 'Berlin, Germany', required: false })
  @IsOptional()
  @Sanitize()
  @IsString()
  location?: string;

  @ApiProperty({ example: '2020-01-15' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2023-12-31', required: false })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({
    example: 'Led development of microservices architecture',
    required: false,
  })
  @IsOptional()
  @Sanitize()
  @IsString()
  description?: string;

  @ApiProperty({ example: false, required: false })
  @IsOptional()
  @IsBoolean()
  current?: boolean;
}

export class ProjectDto {
  @ApiProperty({
    example: 'clx1234567890',
    required: false,
    description: 'If provided, updates existing project; otherwise creates new one',
  })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({ example: 'E-Commerce Platform' })
  @Sanitize()
  @IsString()
  name: string;

  @ApiProperty({
    example: 'Built scalable e-commerce solution using NestJS',
    required: false,
  })
  @IsOptional()
  @Sanitize()
  @IsString()
  description?: string;

  @ApiProperty({
    example: ['TypeScript', 'NestJS', 'PostgreSQL'],
    required: false,
  })
  @IsOptional()
  @SanitizeArray()
  @IsArray()
  @IsString({ each: true })
  technologies?: string[];

  @ApiProperty({ example: 'https://github.com/user/project', required: false })
  @IsOptional()
  @SanitizeUrl()
  @IsUrl()
  url?: string;
}

export class EducationDto {
  @ApiProperty({
    example: 'clx1234567890',
    required: false,
    description: 'If provided, updates existing education; otherwise creates new one',
  })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({ example: 'Bachelor of Science in Computer Science' })
  @Sanitize()
  @IsString()
  degree: string;

  @ApiProperty({ example: 'Stanford University' })
  @Sanitize()
  @IsString()
  institution: string;

  @ApiProperty({ example: 'Computer Science', required: false })
  @IsOptional()
  @Sanitize()
  @IsString()
  fieldOfStudy?: string;

  @ApiProperty({ example: '2018-09-01', required: false })
  @IsOptional()
  @IsDateString()
  startYear?: string;

  @ApiProperty({ example: '2022-06-15', required: false })
  @IsOptional()
  @IsDateString()
  endYear?: string;

  @ApiProperty({ example: '3.8/4.0', required: false })
  @IsOptional()
  @Sanitize()
  @IsString()
  gpa?: string;

  @ApiProperty({
    example: "Focus on Software Engineering and Distributed Systems. Dean's List 2020-2022.",
    required: false,
  })
  @IsOptional()
  @Sanitize()
  @IsString()
  description?: string;
}

export class LanguageDto {
  @ApiProperty({
    example: 'clx1234567890',
    required: false,
    description: 'If provided, updates existing language; otherwise creates new one',
  })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({
    example: 'Deutsch',
    description: 'Language name (e.g., Deutsch, English, Français)',
  })
  @Sanitize()
  @IsString()
  name: string;

  @ApiProperty({
    example: 'NATIVE',
    enum: LanguageProficiency,
    description:
      'Proficiency level (NATIVE, FLUENT, ADVANCED, INTERMEDIATE, BASIC). Also accepts legacy values like Muttersprache, Fließend, etc.',
  })
  @IsOptional()
  @Transform(({ value }) => mapToLanguageProficiency(value))
  level: LanguageProficiency | null;
}

export class UpdateProfileDto {
  @ApiProperty({ example: 'John', required: false })
  @IsOptional()
  @Sanitize()
  @IsString()
  firstName?: string;

  @ApiProperty({ example: 'Doe', required: false })
  @IsOptional()
  @Sanitize()
  @IsString()
  lastName?: string;

  @ApiProperty({
    example: '+49123456789',
    required: false,
    description: 'Phone number in international E.164 format (e.g., +49123456789)',
  })
  @IsOptional()
  @IsPhoneNumber(undefined, {
    message: 'Phone number must be in international format (e.g., +49123456789)',
  })
  @Sanitize()
  @IsString()
  phone?: string;

  @ApiProperty({
    example: 'Musterstraße 123',
    required: false,
    description: 'Street and house number',
  })
  @IsOptional()
  @Sanitize()
  @IsString()
  street?: string;

  @ApiProperty({ example: '47057', required: false, description: 'Postal code (PLZ for Germany)' })
  @IsOptional()
  @Sanitize()
  @IsString()
  postalCode?: string;

  @ApiProperty({ example: 'Duisburg', required: false, description: 'City name' })
  @IsOptional()
  @Sanitize()
  @IsString()
  city?: string;

  @ApiProperty({ example: 'Deutschland', required: false, description: 'Country name' })
  @IsOptional()
  @Sanitize()
  @IsString()
  country?: string;

  @ApiProperty({ example: 'https://linkedin.com/in/johndoe', required: false })
  @IsOptional()
  @SanitizeUrl()
  @IsUrl()
  linkedinUrl?: string;

  @ApiProperty({ example: 'https://github.com/johndoe', required: false })
  @IsOptional()
  @SanitizeUrl()
  @IsUrl()
  githubUrl?: string;

  @ApiProperty({ example: 'https://johndoe.dev', required: false })
  @IsOptional()
  @SanitizeUrl()
  @IsUrl()
  portfolioUrl?: string;

  @ApiProperty({
    example: 'Passionate software engineer with 5+ years experience',
    required: false,
  })
  @IsOptional()
  @Sanitize()
  @IsString()
  summary?: string;

  @ApiProperty({ type: [SkillDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SkillDto)
  skills?: SkillDto[];

  @ApiProperty({ type: [CertificateDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CertificateDto)
  certificates?: CertificateDto[];

  @ApiProperty({ type: [ExperienceDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExperienceDto)
  experiences?: ExperienceDto[];

  @ApiProperty({ type: [ProjectDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProjectDto)
  projects?: ProjectDto[];

  @ApiProperty({
    type: [EducationDto],
    required: false,
    example: [
      {
        degree: 'Bachelor of Science in Computer Science',
        institution: 'Stanford University',
        fieldOfStudy: 'Computer Science',
        startYear: '2018-09-01',
        endYear: '2022-06-15',
        gpa: '3.8/4.0',
        description:
          "Focus on Software Engineering and Distributed Systems. Dean's List 2020-2022.",
      },
    ],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EducationDto)
  education?: EducationDto[];

  @ApiProperty({
    type: [LanguageDto],
    required: false,
    example: [
      { name: 'Deutsch', level: 'Muttersprache' },
      { name: 'English', level: 'Fließend' },
    ],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LanguageDto)
  languages?: LanguageDto[];
}
