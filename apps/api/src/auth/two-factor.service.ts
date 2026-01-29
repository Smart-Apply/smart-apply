import { Injectable, Logger, UnauthorizedException, BadRequestException } from '@nestjs/common';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import * as crypto from 'crypto';
import * as argon2 from 'argon2';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '../config/config.service';
import { AuditLoggerService } from '../common/audit-logger';

// Custom 2FA event types (extend base enum)
const TwoFactorEventTypes = {
  TWO_FACTOR_ENABLED: 'TWO_FACTOR_ENABLED',
  TWO_FACTOR_DISABLED: 'TWO_FACTOR_DISABLED',
  TWO_FACTOR_CHALLENGE_SUCCESS: 'TWO_FACTOR_CHALLENGE_SUCCESS',
  TWO_FACTOR_CHALLENGE_FAILED: 'TWO_FACTOR_CHALLENGE_FAILED',
  TWO_FACTOR_BACKUP_CODE_USED: 'TWO_FACTOR_BACKUP_CODE_USED',
  TWO_FACTOR_DEVICE_TRUSTED: 'TWO_FACTOR_DEVICE_TRUSTED',
  TWO_FACTOR_DEVICE_REVOKED: 'TWO_FACTOR_DEVICE_REVOKED',
} as const;

interface EncryptedData {
  encrypted: string;
  iv: string;
  authTag: string;
}

export interface TwoFactorStatusDto {
  isEnabled: boolean;
  enabledAt: Date | null;
  backupCodesRemaining: number;
  trustedDevicesCount: number;
}

export interface Setup2FAResponseDto {
  tempSecret: string;
  qrCodeDataUrl: string;
  otpAuthUrl: string;
}

export interface TrustedDeviceDto {
  id: string;
  deviceName: string | null;
  browser: string | null;
  os: string | null;
  ipAddress: string | null;
  lastUsedAt: Date;
  createdAt: Date;
  expiresAt: Date;
}

@Injectable()
export class TwoFactorService {
  private readonly logger = new Logger(TwoFactorService.name);
  private readonly ALGORITHM = 'aes-256-gcm';
  private readonly IV_LENGTH = 12; // GCM recommended IV length
  private readonly BACKUP_CODE_COUNT = 10;
  private readonly BACKUP_CODE_LENGTH = 8;
  private readonly TRUSTED_DEVICE_DAYS = 30;
  private readonly ISSUER = 'SmartApply';

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private auditLogger: AuditLoggerService,
  ) {}

  // ===== SETUP FLOW =====

  /**
   * Generate a new TOTP secret for setup (not yet saved)
   * Returns secret and QR code data URL
   */
  async generateSetupSecret(userId: string, email: string): Promise<Setup2FAResponseDto> {
    // Check if user already has 2FA enabled
    const existing = await this.prisma.twoFactorAuth.findUnique({
      where: { userId },
    });

    if (existing?.isEnabled) {
      throw new BadRequestException('2FA is already enabled. Disable it first to set up again.');
    }

    // Generate TOTP secret using speakeasy
    const secret = speakeasy.generateSecret({
      name: `${this.ISSUER}:${email}`,
      issuer: this.ISSUER,
      length: 20,
    });

    // Generate QR code as data URL
    const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url!);

    this.logger.log(`Generated 2FA setup secret for user ${userId}`);

    return {
      tempSecret: secret.base32,
      qrCodeDataUrl,
      otpAuthUrl: secret.otpauth_url!,
    };
  }

  /**
   * Verify the TOTP code during setup and enable 2FA
   * Encrypts and stores the secret, generates backup codes
   */
  async verifyAndEnable(
    userId: string,
    tempSecret: string,
    totpCode: string,
    req: Request,
  ): Promise<{ backupCodes: string[] }> {
    // Verify the TOTP code using speakeasy
    const isValid = speakeasy.totp.verify({
      secret: tempSecret,
      encoding: 'base32',
      token: totpCode,
      window: 1, // Allow 1 period before/after for timing drift
    });

    if (!isValid) {
      throw new UnauthorizedException('Invalid verification code. Please try again.');
    }

    // Generate backup codes
    const backupCodes = this.generateBackupCodes();
    const hashedBackupCodes = await Promise.all(backupCodes.map((code) => argon2.hash(code)));

    // Encrypt the secret
    const encryptedSecret = this.encryptSecret(tempSecret);

    // Save to database in a transaction
    await this.prisma.$transaction(async (tx) => {
      // Upsert TwoFactorAuth record
      const twoFactorAuth = await tx.twoFactorAuth.upsert({
        where: { userId },
        create: {
          userId,
          isEnabled: true,
          encryptedSecret: encryptedSecret.encrypted,
          secretIv: encryptedSecret.iv,
          secretAuthTag: encryptedSecret.authTag,
          verifiedAt: new Date(),
        },
        update: {
          isEnabled: true,
          encryptedSecret: encryptedSecret.encrypted,
          secretIv: encryptedSecret.iv,
          secretAuthTag: encryptedSecret.authTag,
          verifiedAt: new Date(),
        },
      });

      // Delete any existing backup codes
      await tx.twoFactorBackupCode.deleteMany({
        where: { twoFactorAuthId: twoFactorAuth.id },
      });

      // Create new backup codes
      await tx.twoFactorBackupCode.createMany({
        data: hashedBackupCodes.map((codeHash) => ({
          twoFactorAuthId: twoFactorAuth.id,
          codeHash,
        })),
      });
    });

    // Log the event
    this.auditLogger.logSecurityEvent(
      TwoFactorEventTypes.TWO_FACTOR_ENABLED,
      '',
      req,
      userId,
      { action: 'enabled' },
    );

    this.logger.log(`2FA enabled for user ${userId}`);

    // Return plain backup codes ONCE for user to save
    return { backupCodes };
  }

  /**
   * Disable 2FA (requires password confirmation)
   */
  async disable(userId: string, password: string, req: Request): Promise<void> {
    // Verify password
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { password: true, email: true },
    });

    if (!user?.password) {
      throw new UnauthorizedException('Cannot disable 2FA for OAuth accounts without password');
    }

    const isValidPassword = await argon2.verify(user.password, password);
    if (!isValidPassword) {
      throw new UnauthorizedException('Invalid password');
    }

    // Delete 2FA data
    await this.prisma.$transaction(async (tx) => {
      // Delete backup codes first (due to foreign key)
      const twoFactorAuth = await tx.twoFactorAuth.findUnique({
        where: { userId },
      });

      if (twoFactorAuth) {
        await tx.twoFactorBackupCode.deleteMany({
          where: { twoFactorAuthId: twoFactorAuth.id },
        });

        await tx.twoFactorAuth.delete({
          where: { userId },
        });
      }

      // Revoke all trusted devices
      await tx.trustedDevice.deleteMany({
        where: { userId },
      });
    });

    // Log the event
    this.auditLogger.logSecurityEvent(
      TwoFactorEventTypes.TWO_FACTOR_DISABLED,
      user.email,
      req,
      userId,
      { action: 'disabled' },
    );

    this.logger.log(`2FA disabled for user ${userId}`);
  }

  // ===== VERIFICATION =====

  /**
   * Verify a TOTP code or backup code during login
   */
  async verifyCode(userId: string, code: string, req: Request): Promise<boolean> {
    // Try TOTP first
    const isValidTotp = await this.verifyTotpCode(userId, code);
    if (isValidTotp) {
      this.auditLogger.logSecurityEvent(
        TwoFactorEventTypes.TWO_FACTOR_CHALLENGE_SUCCESS,
        '',
        req,
        userId,
        { method: 'totp' },
      );
      return true;
    }

    // Try backup code
    const isValidBackup = await this.verifyBackupCode(userId, code, req);
    if (isValidBackup) {
      return true;
    }

    // Log failed attempt
    this.auditLogger.logSecurityEvent(
      TwoFactorEventTypes.TWO_FACTOR_CHALLENGE_FAILED,
      '',
      req,
      userId,
      { method: 'unknown' },
    );

    return false;
  }

  /**
   * Verify a TOTP code during login
   */
  private async verifyTotpCode(userId: string, code: string): Promise<boolean> {
    const twoFactorAuth = await this.prisma.twoFactorAuth.findUnique({
      where: { userId },
    });

    if (!twoFactorAuth?.isEnabled || !twoFactorAuth.encryptedSecret) {
      return false;
    }

    try {
      const secret = this.decryptSecret(
        twoFactorAuth.encryptedSecret,
        twoFactorAuth.secretIv!,
        twoFactorAuth.secretAuthTag!,
      );

      return speakeasy.totp.verify({
        secret,
        encoding: 'base32',
        token: code,
        window: 1, // Allow 1 period before/after for timing drift
      });
    } catch (error) {
      this.logger.error(`Error verifying TOTP code for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Verify a backup code (marks as used)
   */
  private async verifyBackupCode(userId: string, code: string, req: Request): Promise<boolean> {
    const twoFactorAuth = await this.prisma.twoFactorAuth.findUnique({
      where: { userId },
      include: {
        backupCodes: {
          where: { usedAt: null }, // Only unused codes
        },
      },
    });

    if (!twoFactorAuth?.isEnabled) {
      return false;
    }

    // Check each unused backup code
    for (const backupCode of twoFactorAuth.backupCodes) {
      try {
        const isMatch = await argon2.verify(backupCode.codeHash, code);
        if (isMatch) {
          // Mark as used
          await this.prisma.twoFactorBackupCode.update({
            where: { id: backupCode.id },
            data: { usedAt: new Date() },
          });

          // Log backup code usage
          this.auditLogger.logSecurityEvent(
            TwoFactorEventTypes.TWO_FACTOR_BACKUP_CODE_USED,
            '',
            req,
            userId,
            { remainingCodes: twoFactorAuth.backupCodes.length - 1 },
          );

          this.logger.log(`Backup code used for user ${userId}`);
          return true;
        }
      } catch {
        // Continue checking other codes
      }
    }

    return false;
  }

  // ===== BACKUP CODES =====

  /**
   * Regenerate backup codes (invalidates old ones)
   */
  async regenerateBackupCodes(
    userId: string,
    password: string,
    req: Request,
  ): Promise<string[]> {
    // Verify password
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { password: true },
    });

    if (!user?.password) {
      throw new UnauthorizedException('Cannot regenerate backup codes for OAuth accounts');
    }

    const isValidPassword = await argon2.verify(user.password, password);
    if (!isValidPassword) {
      throw new UnauthorizedException('Invalid password');
    }

    // Check if 2FA is enabled
    const twoFactorAuth = await this.prisma.twoFactorAuth.findUnique({
      where: { userId },
    });

    if (!twoFactorAuth?.isEnabled) {
      throw new BadRequestException('2FA is not enabled');
    }

    // Generate new backup codes
    const backupCodes = this.generateBackupCodes();
    const hashedBackupCodes = await Promise.all(backupCodes.map((code) => argon2.hash(code)));

    // Replace backup codes in transaction
    await this.prisma.$transaction(async (tx) => {
      // Delete old backup codes
      await tx.twoFactorBackupCode.deleteMany({
        where: { twoFactorAuthId: twoFactorAuth.id },
      });

      // Create new backup codes
      await tx.twoFactorBackupCode.createMany({
        data: hashedBackupCodes.map((codeHash) => ({
          twoFactorAuthId: twoFactorAuth.id,
          codeHash,
        })),
      });
    });

    this.logger.log(`Backup codes regenerated for user ${userId}`);

    return backupCodes;
  }

  /**
   * Get number of remaining backup codes
   */
  async getRemainingBackupCodesCount(userId: string): Promise<number> {
    const twoFactorAuth = await this.prisma.twoFactorAuth.findUnique({
      where: { userId },
      include: {
        backupCodes: {
          where: { usedAt: null },
        },
      },
    });

    return twoFactorAuth?.backupCodes.length ?? 0;
  }

  // ===== TRUSTED DEVICES =====

  /**
   * Add a trusted device
   */
  async addTrustedDevice(userId: string, req: Request): Promise<string> {
    // Generate a secure random token
    const deviceToken = crypto.randomBytes(32).toString('hex');
    const deviceTokenHash = await argon2.hash(deviceToken);

    // Parse user agent for device info
    const userAgent = req.headers['user-agent'] || '';
    const deviceInfo = this.parseUserAgent(userAgent);

    // Calculate expiration date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.TRUSTED_DEVICE_DAYS);

    // Create trusted device
    await this.prisma.trustedDevice.create({
      data: {
        userId,
        deviceTokenHash,
        deviceName: deviceInfo.deviceName,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
        ipAddress: this.getClientIp(req),
        expiresAt,
      },
    });

    // Log the event
    this.auditLogger.logSecurityEvent(
      TwoFactorEventTypes.TWO_FACTOR_DEVICE_TRUSTED,
      '',
      req,
      userId,
      { deviceName: deviceInfo.deviceName },
    );

    this.logger.log(`Trusted device added for user ${userId}`);

    return deviceToken;
  }

  /**
   * Check if device is trusted
   */
  async isTrustedDevice(userId: string, deviceToken: string | undefined): Promise<boolean> {
    if (!deviceToken) {
      return false;
    }

    // Get all non-expired trusted devices for user
    const trustedDevices = await this.prisma.trustedDevice.findMany({
      where: {
        userId,
        expiresAt: { gt: new Date() },
      },
    });

    // Check each device token
    for (const device of trustedDevices) {
      try {
        const isMatch = await argon2.verify(device.deviceTokenHash, deviceToken);
        if (isMatch) {
          // Update last used timestamp
          await this.prisma.trustedDevice.update({
            where: { id: device.id },
            data: { lastUsedAt: new Date() },
          });
          return true;
        }
      } catch {
        // Continue checking other devices
      }
    }

    return false;
  }

  /**
   * Get user's trusted devices
   */
  async getTrustedDevices(userId: string): Promise<TrustedDeviceDto[]> {
    const devices = await this.prisma.trustedDevice.findMany({
      where: { userId },
      orderBy: { lastUsedAt: 'desc' },
    });

    return devices.map((device) => ({
      id: device.id,
      deviceName: device.deviceName,
      browser: device.browser,
      os: device.os,
      ipAddress: device.ipAddress,
      lastUsedAt: device.lastUsedAt,
      createdAt: device.createdAt,
      expiresAt: device.expiresAt,
    }));
  }

  /**
   * Revoke a trusted device
   */
  async revokeTrustedDevice(userId: string, deviceId: string, req: Request): Promise<void> {
    const device = await this.prisma.trustedDevice.findFirst({
      where: { id: deviceId, userId },
    });

    if (!device) {
      throw new BadRequestException('Device not found');
    }

    await this.prisma.trustedDevice.delete({
      where: { id: deviceId },
    });

    // Log the event
    this.auditLogger.logSecurityEvent(
      TwoFactorEventTypes.TWO_FACTOR_DEVICE_REVOKED,
      '',
      req,
      userId,
      { deviceName: device.deviceName, deviceId },
    );

    this.logger.log(`Trusted device ${deviceId} revoked for user ${userId}`);
  }

  /**
   * Revoke all trusted devices
   */
  async revokeAllTrustedDevices(userId: string, req: Request): Promise<void> {
    const result = await this.prisma.trustedDevice.deleteMany({
      where: { userId },
    });

    // Log the event
    this.auditLogger.logSecurityEvent(
      TwoFactorEventTypes.TWO_FACTOR_DEVICE_REVOKED,
      '',
      req,
      userId,
      { action: 'revoke_all', count: result.count },
    );

    this.logger.log(`All trusted devices revoked for user ${userId} (${result.count} devices)`);
  }

  // ===== STATUS =====

  /**
   * Check if user has 2FA enabled
   */
  async is2FAEnabled(userId: string): Promise<boolean> {
    const twoFactorAuth = await this.prisma.twoFactorAuth.findUnique({
      where: { userId },
      select: { isEnabled: true },
    });

    return twoFactorAuth?.isEnabled ?? false;
  }

  /**
   * Get 2FA status for settings display
   */
  async get2FAStatus(userId: string): Promise<TwoFactorStatusDto> {
    const twoFactorAuth = await this.prisma.twoFactorAuth.findUnique({
      where: { userId },
      include: {
        backupCodes: {
          where: { usedAt: null },
        },
      },
    });

    const trustedDevicesCount = await this.prisma.trustedDevice.count({
      where: { userId },
    });

    return {
      isEnabled: twoFactorAuth?.isEnabled ?? false,
      enabledAt: twoFactorAuth?.verifiedAt ?? null,
      backupCodesRemaining: twoFactorAuth?.backupCodes.length ?? 0,
      trustedDevicesCount,
    };
  }

  // ===== PRIVATE HELPERS =====

  /**
   * Generate backup codes
   */
  private generateBackupCodes(): string[] {
    const codes: string[] = [];
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude similar chars

    for (let i = 0; i < this.BACKUP_CODE_COUNT; i++) {
      let code = '';
      for (let j = 0; j < this.BACKUP_CODE_LENGTH; j++) {
        code += chars.charAt(crypto.randomInt(chars.length));
      }
      codes.push(code);
    }

    return codes;
  }

  /**
   * Encrypt TOTP secret with AES-256-GCM
   */
  private encryptSecret(secret: string): EncryptedData {
    const key = this.configService.twoFactorEncryptionKey;
    if (!key) {
      throw new Error('TWO_FACTOR_ENCRYPTION_KEY is not configured');
    }

    const iv = crypto.randomBytes(this.IV_LENGTH);
    const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);

    let encrypted = cipher.update(secret, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    return {
      encrypted,
      iv: iv.toString('base64'),
      authTag: cipher.getAuthTag().toString('base64'),
    };
  }

  /**
   * Decrypt TOTP secret
   */
  private decryptSecret(encrypted: string, iv: string, authTag: string): string {
    const key = this.configService.twoFactorEncryptionKey;
    if (!key) {
      throw new Error('TWO_FACTOR_ENCRYPTION_KEY is not configured');
    }

    const decipher = crypto.createDecipheriv(
      this.ALGORITHM,
      key,
      Buffer.from(iv, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(authTag, 'base64'));

    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Parse user agent string for device info
   */
  private parseUserAgent(userAgent: string): { deviceName: string; browser: string; os: string } {
    let deviceName = 'Unknown Device';
    let browser = 'Unknown';
    let os = 'Unknown';

    // Detect OS
    if (userAgent.includes('Windows')) {
      os = 'Windows';
      deviceName = 'Windows PC';
    } else if (userAgent.includes('Macintosh') || userAgent.includes('Mac OS')) {
      os = 'macOS';
      deviceName = 'Mac';
    } else if (userAgent.includes('Linux')) {
      os = 'Linux';
      deviceName = 'Linux PC';
    } else if (userAgent.includes('iPhone')) {
      os = 'iOS';
      deviceName = 'iPhone';
    } else if (userAgent.includes('iPad')) {
      os = 'iOS';
      deviceName = 'iPad';
    } else if (userAgent.includes('Android')) {
      os = 'Android';
      deviceName = 'Android Device';
    }

    // Detect browser
    if (userAgent.includes('Firefox')) {
      browser = 'Firefox';
    } else if (userAgent.includes('Edg')) {
      browser = 'Edge';
    } else if (userAgent.includes('Chrome')) {
      browser = 'Chrome';
    } else if (userAgent.includes('Safari')) {
      browser = 'Safari';
    } else if (userAgent.includes('Opera') || userAgent.includes('OPR')) {
      browser = 'Opera';
    }

    // Combine for device name
    if (browser !== 'Unknown' && os !== 'Unknown') {
      deviceName = `${browser} on ${os}`;
    }

    return { deviceName, browser, os };
  }

  /**
   * Get client IP address
   */
  private getClientIp(req: Request): string {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      (req.headers['x-real-ip'] as string) ||
      req.socket?.remoteAddress ||
      req.ip ||
      'unknown'
    );
  }
}
