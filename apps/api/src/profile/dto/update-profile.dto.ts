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
} from 'class-validator';
import { Type } from 'class-transformer';
import { Sanitize, SanitizeArray } from '../../common/decorators/sanitize.decorator';

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

  @ApiProperty({ example: 'Expert', required: false })
  @IsOptional()
  @Sanitize()
  @IsString()
  level?: string;
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
    example: 'Muttersprache',
    description:
      'Proficiency level (e.g., Muttersprache, Fließend, Gut, Grundkenntnisse / Native, Fluent, Advanced, Basic)',
  })
  @Sanitize()
  @IsString()
  level: string;
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
    description: 'Phone number in international E.164 format (e.g., +49123456789)'
  })
  @IsOptional()
  @IsPhoneNumber(undefined, { 
    message: 'Phone number must be in international format (e.g., +49123456789)' 
  })
  @Sanitize()
  @IsString()
  phone?: string;

  @ApiProperty({ example: 'San Francisco, CA', required: false })
  @IsOptional()
  @Sanitize()
  @IsString()
  location?: string;

  @ApiProperty({ example: 'https://linkedin.com/in/johndoe', required: false })
  @IsOptional()
  @IsUrl()
  linkedinUrl?: string;

  @ApiProperty({ example: 'https://github.com/johndoe', required: false })
  @IsOptional()
  @IsUrl()
  githubUrl?: string;

  @ApiProperty({ example: 'https://johndoe.dev', required: false })
  @IsOptional()
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
