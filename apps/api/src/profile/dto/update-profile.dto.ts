import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsUrl,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SkillDto {
  @ApiProperty({ example: 'TypeScript' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'Expert', required: false })
  @IsOptional()
  @IsString()
  level?: string;
}

export class CertificateDto {
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

export class ExperienceDto {
  @ApiProperty({ example: 'Senior Software Engineer' })
  @IsString()
  title: string;

  @ApiProperty({ example: 'TechCorp Inc.' })
  @IsString()
  company: string;

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
}

export class ProjectDto {
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

export class EducationDto {
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
    example: "Focus on Software Engineering and Distributed Systems. Dean's List 2020-2022.",
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateProfileDto {
  @ApiProperty({ example: 'John Doe', required: false })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiProperty({ example: '+1234567890', required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: 'San Francisco, CA', required: false })
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
    example: 'Passionate software engineer with 5+ years experience',
    required: false,
  })
  @IsOptional()
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
}
