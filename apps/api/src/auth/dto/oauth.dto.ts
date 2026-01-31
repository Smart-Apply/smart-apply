import { IsString, IsEmail, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * OAuth provider types
 */
export enum OAuthProviderType {
  GOOGLE = 'GOOGLE',
  MICROSOFT = 'MICROSOFT',
  LINKEDIN = 'LINKEDIN',
  APPLE = 'APPLE',
  FACEBOOK = 'FACEBOOK',
}

/**
 * DTO for validating OAuth user data from OAuth providers
 */
export class OAuthUserDto {
  @ApiProperty({ description: 'OAuth provider type', enum: OAuthProviderType })
  @IsEnum(OAuthProviderType)
  provider: OAuthProviderType;

  @ApiProperty({ description: 'External OAuth provider ID (sub claim)' })
  @IsString()
  providerId: string;

  @ApiProperty({ description: 'User email from OAuth provider' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'User first name', required: false })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiProperty({ description: 'User last name', required: false })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty({ description: 'Profile picture URL', required: false })
  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @ApiProperty({ description: 'OAuth access token', required: false })
  @IsOptional()
  @IsString()
  accessToken?: string;

  @ApiProperty({ description: 'OAuth refresh token', required: false })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}

/**
 * DTO for linking OAuth provider to existing account
 */
export class LinkOAuthProviderDto {
  @ApiProperty({ description: 'OAuth provider type', enum: OAuthProviderType })
  @IsEnum(OAuthProviderType)
  provider: OAuthProviderType;

  @ApiProperty({ description: 'OAuth provider ID' })
  @IsString()
  providerId: string;

  @ApiProperty({ description: 'Access token from OAuth provider', required: false })
  @IsOptional()
  @IsString()
  accessToken?: string;

  @ApiProperty({ description: 'Refresh token from OAuth provider', required: false })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}

/**
 * DTO for unlinking OAuth provider
 */
export class UnlinkOAuthProviderDto {
  @ApiProperty({ description: 'OAuth provider type to unlink', enum: OAuthProviderType })
  @IsEnum(OAuthProviderType)
  provider: OAuthProviderType;
}
