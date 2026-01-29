import { IsString, IsNotEmpty, Length, IsBoolean, IsOptional, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// ===== Setup Flow =====

export class Setup2FAResponseDto {
  @ApiProperty({ description: 'Temporary secret (do not store, use only for QR display)' })
  tempSecret: string;

  @ApiProperty({ description: 'QR code as data URL for scanning' })
  qrCodeDataUrl: string;

  @ApiProperty({ description: 'otpauth:// URL for manual entry in authenticator app' })
  otpAuthUrl: string;
}

export class Verify2FASetupDto {
  @ApiProperty({ example: '123456', description: 'TOTP code from authenticator app' })
  @IsString()
  @Length(6, 6, { message: 'TOTP code must be exactly 6 digits' })
  @Matches(/^\d{6}$/, { message: 'TOTP code must contain only digits' })
  code: string;

  @ApiProperty({ description: 'Temporary secret from setup step' })
  @IsString()
  @IsNotEmpty()
  tempSecret: string;
}

// ===== Login Flow =====

export class Verify2FALoginDto {
  @ApiProperty({ description: 'Challenge token from login response' })
  @IsString()
  @IsNotEmpty()
  challengeToken: string;

  @ApiProperty({ example: '123456', description: 'TOTP code or backup code' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ example: false, description: 'Whether to trust this device for 30 days' })
  @IsBoolean()
  @IsOptional()
  trustDevice?: boolean;
}

// ===== Disable 2FA =====

export class Disable2FADto {
  @ApiProperty({ description: 'Current password for confirmation' })
  @IsString()
  @IsNotEmpty({ message: 'Password is required to disable 2FA' })
  password: string;
}

// ===== Backup Codes =====

export class RegenerateBackupCodesDto {
  @ApiProperty({ description: 'Current password for confirmation' })
  @IsString()
  @IsNotEmpty({ message: 'Password is required to regenerate backup codes' })
  password: string;
}

// ===== Status =====

export class TwoFactorStatusResponseDto {
  @ApiProperty({ example: true, description: 'Whether 2FA is enabled' })
  isEnabled: boolean;

  @ApiProperty({ example: '2024-01-15T10:30:00Z', description: 'When 2FA was enabled', nullable: true })
  enabledAt: Date | null;

  @ApiProperty({ example: 8, description: 'Number of unused backup codes remaining' })
  backupCodesRemaining: number;

  @ApiProperty({ example: 2, description: 'Number of trusted devices' })
  trustedDevicesCount: number;
}

// ===== Trusted Devices =====

export class TrustedDeviceResponseDto {
  @ApiProperty({ example: 'clx1abc123', description: 'Device ID' })
  id: string;

  @ApiProperty({ example: 'Chrome on macOS', description: 'Device name', nullable: true })
  deviceName: string | null;

  @ApiProperty({ example: 'Chrome', description: 'Browser name', nullable: true })
  browser: string | null;

  @ApiProperty({ example: 'macOS', description: 'Operating system', nullable: true })
  os: string | null;

  @ApiProperty({ example: '192.168.1.1', description: 'IP address', nullable: true })
  ipAddress: string | null;

  @ApiProperty({ example: '2024-01-15T10:30:00Z', description: 'Last used timestamp' })
  lastUsedAt: Date;

  @ApiProperty({ example: '2024-01-10T10:30:00Z', description: 'Created timestamp' })
  createdAt: Date;

  @ApiProperty({ example: '2024-02-09T10:30:00Z', description: 'Expiration timestamp' })
  expiresAt: Date;
}

// ===== Challenge Response =====

export class TwoFactorChallengeResponseDto {
  @ApiProperty({ example: true, description: 'Indicates 2FA is required' })
  requiresTwoFactor: boolean;

  @ApiProperty({ description: 'Temporary token to identify this login attempt' })
  challengeToken: string;

  @ApiProperty({ example: ['totp', 'backup_code'], description: 'Available verification methods' })
  methods: string[];
}
