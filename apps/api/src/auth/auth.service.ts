import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto, LoginDto } from './dto';
import { ConfigService } from '../config/config.service';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(dto: RegisterDto, userAgent?: string, ipAddress?: string) {
    // Check if user exists
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException('User with this email already exists');
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

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.email, userAgent, ipAddress);

    return {
      user,
      ...tokens,
    };
  }

  async login(dto: LoginDto, userAgent?: string, ipAddress?: string) {
    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const valid = await argon2.verify(user.password, dto.password);

    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.email, userAgent, ipAddress);

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

  async refresh(refreshToken: string, userAgent?: string, ipAddress?: string): Promise<TokenPair> {
    // Verify refresh token signature
    let payload: any;
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.jwtSecret,
      });
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Verify token type
    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
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
      throw new UnauthorizedException('Refresh token not found or revoked');
    }

    // Verify the provided token matches one of the stored hashes
    let matchingToken: typeof storedTokens[0] | null = null;
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
      throw new UnauthorizedException('Refresh token not found or revoked');
    }

    // Revoke the specific refresh token (rotation strategy)
    await this.prisma.refreshToken.update({
      where: { id: matchingToken.id },
      data: { isRevoked: true },
    });

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

    // Generate new token pair
    const tokens = await this.generateTokens(payload.sub, payload.email, userAgent, ipAddress);

    return tokens;
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

  private async generateTokens(
    userId: string,
    email: string,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<TokenPair> {
    // Generate access token (short-lived)
    const accessToken = this.jwtService.sign(
      { sub: userId, email, type: 'access' },
      { expiresIn: this.configService.jwtAccessExpiresIn },
    );

    // Generate refresh token (long-lived) with unique identifier
    const refreshToken = this.jwtService.sign(
      { 
        sub: userId, 
        email, 
        type: 'refresh',
        jti: `${Date.now()}-${Math.random().toString(36).substring(7)}`, // Unique token ID
      },
      { expiresIn: this.configService.jwtRefreshExpiresIn },
    );

    // Calculate expiration date for refresh token
    const expiresIn = this.configService.jwtRefreshExpiresIn;
    const expiresAt = this.calculateExpirationDate(expiresIn);

    // Hash the refresh token before storing
    const hashedToken = await argon2.hash(refreshToken);

    // Store refresh token in database
    await this.prisma.refreshToken.create({
      data: {
        token: hashedToken,
        userId,
        expiresAt,
        userAgent,
        ipAddress,
      },
    });

    // Enforce max tokens per user (e.g., 5 devices)
    const MAX_TOKENS_PER_USER = 5;
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
      await this.prisma.refreshToken.updateMany({
        where: {
          id: { in: tokensToRevoke.map((t) => t.id) },
        },
        data: { isRevoked: true },
      });
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
