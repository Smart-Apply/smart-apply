import { Injectable } from '@nestjs/common';
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

  async updatePreferences(userId: string, dto: UpdateUserPreferencesDto): Promise<UserPreferencesResponseDto> {
    // Upsert preferences (create if not exists, update if exists)
    const preferences = await this.prisma.userPreferences.upsert({
      where: { userId },
      create: {
        userId,
        ...(dto.applicationUpdates !== undefined && { applicationUpdates: dto.applicationUpdates }),
        ...(dto.newJobPostings !== undefined && { newJobPostings: dto.newJobPostings }),
        ...(dto.marketingEmails !== undefined && { marketingEmails: dto.marketingEmails }),
        ...(dto.language !== undefined && { language: dto.language }),
        ...(dto.theme !== undefined && { theme: dto.theme }),
        ...(dto.profilePublic !== undefined && { profilePublic: dto.profilePublic }),
        ...(dto.analyticsEnabled !== undefined && { analyticsEnabled: dto.analyticsEnabled }),
      },
      update: {
        ...(dto.applicationUpdates !== undefined && { applicationUpdates: dto.applicationUpdates }),
        ...(dto.newJobPostings !== undefined && { newJobPostings: dto.newJobPostings }),
        ...(dto.marketingEmails !== undefined && { marketingEmails: dto.marketingEmails }),
        ...(dto.language !== undefined && { language: dto.language }),
        ...(dto.theme !== undefined && { theme: dto.theme }),
        ...(dto.profilePublic !== undefined && { profilePublic: dto.profilePublic }),
        ...(dto.analyticsEnabled !== undefined && { analyticsEnabled: dto.analyticsEnabled }),
      },
    });

    return this.mapToResponseDto(preferences);
  }

  private mapToResponseDto(preferences: any): UserPreferencesResponseDto {
    return {
      id: preferences.id,
      userId: preferences.userId,
      applicationUpdates: preferences.applicationUpdates,
      newJobPostings: preferences.newJobPostings,
      marketingEmails: preferences.marketingEmails,
      language: preferences.language,
      theme: preferences.theme,
      profilePublic: preferences.profilePublic,
      analyticsEnabled: preferences.analyticsEnabled,
      createdAt: preferences.createdAt,
      updatedAt: preferences.updatedAt,
    };
  }
}
