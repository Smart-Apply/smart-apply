import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsUrl,
  IsDateString,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ExtractedSkillDto {
  @ApiProperty({ example: 'TypeScript' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'Expert', required: false })
  @IsOptional()
  @IsString()
  level?: string;
}

export class ExtractedCertificateDto {
  @ApiProperty({ example: 'AWS Certified Solutions Architect' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'Amazon Web Services' })
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

export class ExtractedExperienceDto {
  @ApiProperty({ example: 'Senior Software Engineer' })
  @IsString()
  title: string;

  @ApiProperty({ example: 'TechCorp Inc.' })
  @IsString()
  company: string;

  @ApiProperty({ example: 'Berlin, Germany', required: false })
  @IsOptional()
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
  @IsString()
  description?: string;

  @ApiProperty({ example: false, required: false })
  @IsOptional()
  @IsBoolean()
  current?: boolean;
}

export class ExtractedProjectDto {
  @ApiProperty({ example: 'E-Commerce Platform' })
  @IsString()
  name: string;

  @ApiProperty({
    example: 'Built scalable e-commerce solution using NestJS',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    example: ['TypeScript', 'NestJS', 'PostgreSQL'],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  technologies?: string[];

  @ApiProperty({ example: 'https://github.com/user/project', required: false })
  @IsOptional()
  @IsUrl()
  url?: string;
}

export class ExtractedEducationDto {
  @ApiProperty({ example: 'Bachelor of Science in Computer Science' })
  @IsString()
  degree: string;

  @ApiProperty({ example: 'Stanford University' })
  @IsString()
  institution: string;

  @ApiProperty({ example: 'Computer Science', required: false })
  @IsOptional()
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
  @IsString()
  gpa?: string;

  @ApiProperty({
    example: "Focus on Software Engineering. Dean's List 2020-2022.",
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;
}

export class ExtractedLanguageDto {
  @ApiProperty({
    example: 'Deutsch',
    description: 'Language name (e.g., Deutsch, English, Français)',
  })
  @IsString()
  name: string;

  @ApiProperty({
    example: 'Muttersprache',
    description: 'Proficiency level (e.g., Muttersprache, Fließend, Gut, Grundkenntnisse)',
  })
  @IsString()
  level: string;
}

export class ExtractedProfileDto {
  @ApiProperty({ example: 'John', required: false })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiProperty({ example: 'Doe', required: false })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty({ example: '+49123456789', required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: 'Berlin, Germany', required: false })
  @IsOptional()
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
    example: 'Experienced software engineer with focus on cloud technologies',
    required: false,
  })
  @IsOptional()
  @IsString()
  summary?: string;

  @ApiProperty({ type: [ExtractedSkillDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExtractedSkillDto)
  skills?: ExtractedSkillDto[];

  @ApiProperty({ type: [ExtractedCertificateDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExtractedCertificateDto)
  certificates?: ExtractedCertificateDto[];

  @ApiProperty({ type: [ExtractedExperienceDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExtractedExperienceDto)
  experiences?: ExtractedExperienceDto[];

  @ApiProperty({ type: [ExtractedProjectDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExtractedProjectDto)
  projects?: ExtractedProjectDto[];

  @ApiProperty({ type: [ExtractedEducationDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExtractedEducationDto)
  education?: ExtractedEducationDto[];

  @ApiProperty({ type: [ExtractedLanguageDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExtractedLanguageDto)
  languages?: ExtractedLanguageDto[];
}
