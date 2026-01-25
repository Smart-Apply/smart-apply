import { Injectable, UnauthorizedException, Inject, forwardRef, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import {
  RegisterDto,
  LoginDto,
  UpdateUserProfileDto,
  ChangePasswordDto,
  DeleteAccountDto,
} from './dto';
import { ConfigService } from '../config/config.service';
import { AuditLoggerService } from '../common/audit-logger';
import { SessionService } from './session.service';
import { MAX_TOKENS_PER_USER } from './session.constants';
import { Request } from 'express';
import { ErrorCode } from '../common/constants/error-codes';
import {
  ConflictWithCode,
  UnauthorizedWithCode,
  BadRequestWithCode,
} from '../common/exceptions/coded-http.exception';
import { SubscriptionService } from '../subscription/subscription.service';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private auditLogger: AuditLoggerService,
    // Use forwardRef to resolve circular dependency between AuthService and SessionService
    // This is acceptable as both services are in the same module and need each other
    @Inject(forwardRef(() => SessionService))
    private sessionService: SessionService,
    private subscriptionService: SubscriptionService,
  ) {}

  async register(dto: RegisterDto, userAgent?: string, ipAddress?: string, req?: Request) {
    // Check if user exists
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictWithCode(ErrorCode.USER_EXISTS);
    }

    // Hash password
    const hashedPassword = await argon2.hash(dto.password);

    // Create user and profile in a transaction
    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: dto.email,
          password: hashedPassword,
          firstName: dto.firstName,
          lastName: dto.lastName,
          provider: 'local',
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          createdAt: true,
        },
      });

      // Create empty profile for new user
      await tx.profile.create({
        data: {
          userId: newUser.id,
        },
      });

      return newUser;
    });

    // Create default FREE subscription for new user
    // This is done outside the transaction to avoid circular dependency issues
    try {
      await this.subscriptionService.getOrCreateSubscription(user.id);
      this.logger.log(`Created FREE subscription for new user ${user.id}`);
    } catch (error) {
      this.logger.error(`Failed to create subscription for user ${user.id}:`, error);
      // Don't fail registration if subscription creation fails
      // The subscription will be created lazily on first access
    }

    // Log registration event
    if (req) {
      this.auditLogger.logRegistration(user.email, user.id, req);
    }

    // Generate tokens and create session
    const tokens = await this.generateTokens(user.id, user.email, userAgent, ipAddress, req);

    return {
      user,
      ...tokens,
    };
  }

  async login(dto: LoginDto, userAgent?: string, ipAddress?: string, req?: Request) {
    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !user.password) {
      // Log failed login attempt
      if (req) {
        this.auditLogger.logLoginAttempt(dto.email, false, req);
      }
      throw new UnauthorizedWithCode(ErrorCode.INVALID_CREDENTIALS);
    }

    // Verify password
    const valid = await argon2.verify(user.password, dto.password);

    if (!valid) {
      // Log failed login attempt
      if (req) {
        this.auditLogger.logLoginAttempt(dto.email, false, req, user.id);
      }
      throw new UnauthorizedWithCode(ErrorCode.INVALID_CREDENTIALS);
    }

    // Log successful login
    if (req) {
      this.auditLogger.logLoginAttempt(dto.email, true, req, user.id);
    }

    // Generate tokens and create session
    const tokens = await this.generateTokens(user.id, user.email, userAgent, ipAddress, req);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      ...tokens,
    };
  }

  async refresh(
    refreshToken: string,
    userAgent?: string,
    ipAddress?: string,
    req?: Request,
  ): Promise<TokenPair> {
    // Verify refresh token signature
    let payload: any;
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.jwtSecret,
      });
    } catch (error) {
      throw new UnauthorizedWithCode(ErrorCode.REFRESH_TOKEN_INVALID);
    }

    // Verify token type
    if (payload.type !== 'refresh') {
      throw new UnauthorizedWithCode(ErrorCode.INVALID_TOKEN_TYPE);
    }

    // Find all non-revoked, non-expired refresh tokens for this user
    const storedTokens = await this.prisma.refreshToken.findMany({
      where: {
        userId: payload.sub,
        isRevoked: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (storedTokens.length === 0) {
      throw new UnauthorizedWithCode(ErrorCode.REFRESH_TOKEN_NOT_FOUND);
    }

    // Verify the provided token matches one of the stored hashes
    let matchingToken: (typeof storedTokens)[0] | null = null;
    for (const storedToken of storedTokens) {
      try {
        const isMatch = await argon2.verify(storedToken.token, refreshToken);
        if (isMatch) {
          matchingToken = storedToken;
          break;
        }
      } catch (error) {
        // Skip invalid hashes
        continue;
      }
    }

    if (!matchingToken) {
      throw new UnauthorizedWithCode(ErrorCode.REFRESH_TOKEN_NOT_FOUND);
    }

    // Log refresh token usage
    if (req) {
      this.auditLogger.logRefreshTokenUsed(payload.sub, payload.email, req);
    }

    // Find session associated with this refresh token
    const session = await this.sessionService.findSessionByRefreshToken(matchingToken.id);

    // Update session last active timestamp
    if (session) {
      await this.sessionService.updateLastActive(session.id);
    }

    // Revoke the specific refresh token (rotation strategy)
    await this.prisma.refreshToken.update({
      where: { id: matchingToken.id },
      data: { isRevoked: true },
    });

    // Revoke the session associated with the old refresh token
    if (session) {
      await this.sessionService.revokeSession(session.id);
    }

    // Clean up old/expired tokens for this user (but keep recently revoked for security audit)
    await this.prisma.refreshToken.deleteMany({
      where: {
        userId: payload.sub,
        OR: [
          { expiresAt: { lt: new Date() } },
          {
            AND: [
              { isRevoked: true },
              { createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } }, // Keep revoked tokens for 24h
            ],
          },
        ],
      },
    });

    // Generate new token pair and create new session
    const tokens = await this.generateTokens(payload.sub, payload.email, userAgent, ipAddress, req);

    return tokens;
  }

  async logout(userId: string, req: Request): Promise<void> {
    // Log logout event
    this.auditLogger.logLogout(userId, req);

    // Revoke all sessions for this user
    await this.sessionService.revokeAllSessions(userId);

    // Revoke all refresh tokens for this user
    await this.revokeRefreshToken(userId);
  }

  async revokeRefreshToken(userId: string, tokenId?: string): Promise<void> {
    if (tokenId) {
      // Revoke specific token
      await this.prisma.refreshToken.updateMany({
        where: {
          id: tokenId,
          userId,
        },
        data: { isRevoked: true },
      });
    } else {
      // Revoke all tokens for user (logout from all devices)
      await this.prisma.refreshToken.updateMany({
        where: { userId },
        data: { isRevoked: true },
      });
    }
  }

  async validateUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        provider: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }

  async updateUserProfile(userId: string, dto: UpdateUserProfileDto, req?: Request) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.firstName !== undefined && { firstName: dto.firstName }),
        ...(dto.lastName !== undefined && { lastName: dto.lastName }),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        createdAt: true,
      },
    });

    // Log profile update event
    if (req) {
      this.auditLogger.logProfileUpdate(userId, req, {
        updatedFields: Object.keys(dto).filter(
          (key) => dto[key as keyof UpdateUserProfileDto] !== undefined,
        ),
      });
    }

    return user;
  }

  async changePassword(userId: string, dto: ChangePasswordDto, req?: Request): Promise<void> {
    // Get user with password
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, password: true },
    });

    if (!user || !user.password) {
      throw new BadRequestWithCode(ErrorCode.PASSWORD_CHANGE_OAUTH);
    }

    // Verify current password
    const valid = await argon2.verify(user.password, dto.currentPassword);
    if (!valid) {
      // Log failed password change attempt
      if (req) {
        this.auditLogger.logSecurityEvent('PASSWORD_CHANGE_FAILED', user.email, req, user.id, {
          reason: 'Invalid current password',
        });
      }
      throw new BadRequestWithCode(ErrorCode.PASSWORD_INCORRECT);
    }

    // Ensure new password is different from current
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestWithCode(ErrorCode.PASSWORD_SAME_AS_CURRENT);
    }

    // Hash new password
    const hashedPassword = await argon2.hash(dto.newPassword);

    // Update password
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    // Revoke all refresh tokens (force re-login on all devices)
    await this.revokeRefreshToken(userId);

    // Revoke all sessions
    await this.sessionService.revokeAllSessions(userId);

    // Log successful password change
    if (req) {
      this.auditLogger.logPasswordChange(user.id, req);
    }
  }

  async deleteAccount(userId: string, dto: DeleteAccountDto, req?: Request): Promise<void> {
    // Get user with password
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, password: true },
    });

    if (!user) {
      throw new UnauthorizedWithCode(ErrorCode.USER_NOT_FOUND);
    }

    // For local accounts, verify password
    if (user.password) {
      const valid = await argon2.verify(user.password, dto.password);
      if (!valid) {
        // Log failed account deletion attempt
        if (req) {
          this.auditLogger.logSecurityEvent('ACCOUNT_DELETE_FAILED', user.email, req, user.id, {
            reason: 'Invalid password',
          });
        }
        throw new BadRequestWithCode(ErrorCode.PASSWORD_INCORRECT);
      }
    }

    // Get all applications to clean up storage files
    const applications = await this.prisma.application.findMany({
      where: { userId },
      select: { coverLetterFileKey: true, resumeFileKey: true },
    });

    // Collect file keys to delete (will be handled by cascade delete from DB,
    // but we need to track them for storage cleanup)
    const fileKeysToDelete: string[] = [];
    for (const app of applications) {
      if (app.coverLetterFileKey) fileKeysToDelete.push(app.coverLetterFileKey);
      if (app.resumeFileKey) fileKeysToDelete.push(app.resumeFileKey);
    }

    // Log account deletion event before deleting
    if (req) {
      this.auditLogger.logSecurityEvent('ACCOUNT_DELETED', user.email, req, user.id, {
        applicationsDeleted: applications.length,
        filesDeleted: fileKeysToDelete.length,
      });
    }

    // Delete user (cascade will delete Profile, Applications, JobPostings, Sessions, RefreshTokens, UserPreferences)
    await this.prisma.user.delete({
      where: { id: userId },
    });

    // Note: Storage cleanup would need StorageService injection to delete actual files
    // For now, we rely on database cascade delete. File cleanup can be done via a cleanup job.
  }

  private async generateTokens(
    userId: string,
    email: string,
    userAgent?: string,
    ipAddress?: string,
    req?: Request,
  ): Promise<TokenPair> {
    // Generate access token (short-lived)
    const accessToken = this.jwtService.sign(
      { sub: userId, email, type: 'access' },
      { expiresIn: this.configService.jwtAccessExpiresIn as any },
    );

    // Generate refresh token (long-lived) with unique identifier
    const refreshToken = this.jwtService.sign(
      {
        sub: userId,
        email,
        type: 'refresh',
        jti: `${Date.now()}-${Math.random().toString(36).substring(7)}`, // Unique token ID
      },
      { expiresIn: this.configService.jwtRefreshExpiresIn as any },
    );

    // Calculate expiration date for refresh token
    const expiresIn = this.configService.jwtRefreshExpiresIn;
    const expiresAt = this.calculateExpirationDate(expiresIn);

    // Hash the refresh token before storing
    const hashedToken = await argon2.hash(refreshToken);

    // Store refresh token in database
    const storedRefreshToken = await this.prisma.refreshToken.create({
      data: {
        token: hashedToken,
        userId,
        expiresAt,
        userAgent,
        ipAddress,
      },
    });

    // Create session for this refresh token
    if (req) {
      await this.sessionService.createSession(userId, storedRefreshToken.id, req);
    }

    // Enforce max tokens per user
    const userTokens = await this.prisma.refreshToken.findMany({
      where: {
        userId,
        isRevoked: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Revoke oldest tokens if limit exceeded
    if (userTokens.length > MAX_TOKENS_PER_USER) {
      const tokensToRevoke = userTokens.slice(MAX_TOKENS_PER_USER);
      const tokenIdsToRevoke = tokensToRevoke.map((t) => t.id);

      await this.prisma.refreshToken.updateMany({
        where: {
          id: { in: tokenIdsToRevoke },
        },
        data: { isRevoked: true },
      });

      // Also revoke associated sessions
      for (const tokenId of tokenIdsToRevoke) {
        await this.sessionService.revokeSessionByRefreshToken(tokenId);
      }
    }

    return { accessToken, refreshToken };
  }

  private calculateExpirationDate(expiresIn: string): Date {
    const now = new Date();
    const match = expiresIn.match(/^(\d+)([smhd])$/);

    if (!match) {
      throw new Error(`Invalid expiresIn format: ${expiresIn}`);
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's':
        return new Date(now.getTime() + value * 1000);
      case 'm':
        return new Date(now.getTime() + value * 60 * 1000);
      case 'h':
        return new Date(now.getTime() + value * 60 * 60 * 1000);
      case 'd':
        return new Date(now.getTime() + value * 24 * 60 * 60 * 1000);
      default:
        throw new Error(`Unknown time unit: ${unit}`);
    }
  }
}
