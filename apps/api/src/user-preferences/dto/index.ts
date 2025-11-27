import { IsBoolean, IsOptional, IsString, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserPreferencesDto {
  // Notifications
  @ApiProperty({ example: true, required: false, description: 'Receive application update notifications' })
  @IsOptional()
  @IsBoolean()
  applicationUpdates?: boolean;

  @ApiProperty({ example: false, required: false, description: 'Receive new job posting notifications' })
  @IsOptional()
  @IsBoolean()
  newJobPostings?: boolean;

  @ApiProperty({ example: false, required: false, description: 'Receive marketing emails' })
  @IsOptional()
  @IsBoolean()
  marketingEmails?: boolean;

  // Preferences
  @ApiProperty({ example: 'de', required: false, description: 'Preferred language (de, en, fr, es)' })
  @IsOptional()
  @IsString()
  @IsIn(['de', 'en', 'fr', 'es'], { message: 'Language must be one of: de, en, fr, es' })
  language?: string;

  @ApiProperty({ example: 'system', required: false, description: 'Theme preference (light, dark, system)' })
  @IsOptional()
  @IsString()
  @IsIn(['light', 'dark', 'system'], { message: 'Theme must be one of: light, dark, system' })
  theme?: string;

  @ApiProperty({ example: false, required: false, description: 'Make profile visible to others' })
  @IsOptional()
  @IsBoolean()
  profilePublic?: boolean;

  @ApiProperty({ example: true, required: false, description: 'Allow analytics data collection' })
  @IsOptional()
  @IsBoolean()
  analyticsEnabled?: boolean;
}

export class UserPreferencesResponseDto {
  @ApiProperty({ example: 'clq1234567890' })
  id: string;

  @ApiProperty({ example: 'clq0987654321' })
  userId: string;

  @ApiProperty({ example: true })
  applicationUpdates: boolean;

  @ApiProperty({ example: false })
  newJobPostings: boolean;

  @ApiProperty({ example: false })
  marketingEmails: boolean;

  @ApiProperty({ example: 'de' })
  language: string;

  @ApiProperty({ example: 'system' })
  theme: string;

  @ApiProperty({ example: false })
  profilePublic: boolean;

  @ApiProperty({ example: true })
  analyticsEnabled: boolean;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  updatedAt: Date;
}
