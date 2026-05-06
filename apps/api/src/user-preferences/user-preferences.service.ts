import { Injectable } from '@nestjs/common';
import { UserPreferences } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserPreferencesDto, UserPreferencesResponseDto } from './dto';

@Injectable()
export class UserPreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  async getPreferences(userId: string): Promise<UserPreferencesResponseDto> {
    // Try to find existing preferences
    let preferences = await this.prisma.userPreferences.findUnique({
      where: { userId },
    });

    // If no preferences exist, create default preferences
    if (!preferences) {
      preferences = await this.prisma.userPreferences.create({
        data: {
          userId,
          // All other fields use schema defaults
        },
      });
    }

    return this.mapToResponseDto(preferences);
  }

  async updatePreferences(
    userId: string,
    dto: UpdateUserPreferencesDto,
  ): Promise<UserPreferencesResponseDto> {
    // Build update data from DTO
    const updateData = this.buildUpdateData(dto);

    // Upsert preferences (create if not exists, update if exists)
    const preferences = await this.prisma.userPreferences.upsert({
      where: { userId },
      create: {
        userId,
        ...updateData,
      },
      update: updateData,
    });

    return this.mapToResponseDto(preferences);
  }

  private buildUpdateData(dto: UpdateUserPreferencesDto): Partial<UserPreferences> {
    const data: Partial<UserPreferences> = {};

    if (dto.applicationUpdates !== undefined) data.applicationUpdates = dto.applicationUpdates;
    if (dto.newJobPostings !== undefined) data.newJobPostings = dto.newJobPostings;
    if (dto.marketingEmails !== undefined) data.marketingEmails = dto.marketingEmails;
    if (dto.emailTrackingNotify !== undefined)
      data.emailTrackingNotify = dto.emailTrackingNotify;
    if (dto.language !== undefined) data.language = dto.language;
    if (dto.theme !== undefined) data.theme = dto.theme;
    if (dto.profilePublic !== undefined) data.profilePublic = dto.profilePublic;
    if (dto.analyticsEnabled !== undefined) data.analyticsEnabled = dto.analyticsEnabled;

    return data;
  }

  private mapToResponseDto(preferences: UserPreferences): UserPreferencesResponseDto {
    return {
      id: preferences.id,
      userId: preferences.userId,
      applicationUpdates: preferences.applicationUpdates,
      newJobPostings: preferences.newJobPostings,
      marketingEmails: preferences.marketingEmails,
      emailTrackingNotify: preferences.emailTrackingNotify,
      language: preferences.language,
      theme: preferences.theme,
      profilePublic: preferences.profilePublic,
      analyticsEnabled: preferences.analyticsEnabled,
      createdAt: preferences.createdAt,
      updatedAt: preferences.updatedAt,
    };
  }
}
