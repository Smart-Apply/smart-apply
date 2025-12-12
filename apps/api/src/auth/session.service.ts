import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Request } from 'express';
import * as UAParser from 'ua-parser-js';
import {
  MAX_SESSIONS_PER_USER,
  SESSION_EXPIRATION_DAYS,
  REVOKED_SESSION_CLEANUP_DAYS,
  OLD_SESSION_CLEANUP_DAYS,
  REVOKED_REFRESH_TOKEN_CLEANUP_DAYS,
} from './session.constants';

@Injectable()
export class SessionService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create a new session for the user
   */
  async createSession(userId: string, refreshTokenId: string, req: Request): Promise<any> {
    const parser = new UAParser.UAParser(req.headers['user-agent']);
    const device = parser.getResult();

    // Check session limit (internal - no pagination needed)
    const activeSessions = await this.getAllActiveSessionsInternal(userId);
    if (activeSessions.length >= MAX_SESSIONS_PER_USER) {
      // Remove oldest session (FIFO)
      await this.revokeSession(activeSessions[activeSessions.length - 1].id);
    }

    // Calculate session expiration
    const expiresAt = new Date(Date.now() + SESSION_EXPIRATION_DAYS * 24 * 60 * 60 * 1000);

    return this.prisma.session.create({
      data: {
        userId,
        refreshTokenId,
        deviceName: this.getDeviceName(device),
        deviceType: device.device.type || 'desktop',
        browser: `${device.browser.name || 'Unknown'} ${device.browser.version || ''}`.trim(),
        os: `${device.os.name || 'Unknown'} ${device.os.version || ''}`.trim(),
        ipAddress: this.getClientIp(req),
        expiresAt,
      },
    });
  }

  /**
   * Internal method to get ALL active sessions (no pagination)
   * Used for session limit checks
   */
  private async getAllActiveSessionsInternal(userId: string) {
    return this.prisma.session.findMany({
      where: {
        userId,
        isActive: true,
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastActiveAt: 'desc' },
    });
  }

  /**
   * Get all active sessions for a user with pagination
   */
  async getActiveSessions(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<{ items: any[]; pagination: any }> {
    const [sessions, total] = await Promise.all([
      this.prisma.session.findMany({
        where: {
          userId,
          isActive: true,
          expiresAt: { gt: new Date() },
        },
        orderBy: { lastActiveAt: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      }),
      this.prisma.session.count({
        where: {
          userId,
          isActive: true,
          expiresAt: { gt: new Date() },
        },
      }),
    ]);

    return {
      items: sessions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update the last active timestamp for a session
   */
  async updateLastActive(sessionId: string): Promise<void> {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { lastActiveAt: new Date() },
    });
  }

  /**
   * Revoke a specific session
   */
  async revokeSession(sessionId: string): Promise<void> {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        isActive: false,
        revokedAt: new Date(),
      },
    });
  }

  /**
   * Revoke all sessions for a user (except optionally one)
   */
  async revokeAllSessions(userId: string, exceptSessionId?: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: {
        userId,
        isActive: true,
        ...(exceptSessionId && { id: { not: exceptSessionId } }),
      },
      data: {
        isActive: false,
        revokedAt: new Date(),
      },
    });
  }

  /**
   * Revoke session by refresh token ID
   */
  async revokeSessionByRefreshToken(refreshTokenId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: {
        refreshTokenId,
        isActive: true,
      },
      data: {
        isActive: false,
        revokedAt: new Date(),
      },
    });
  }

  /**
   * Find session by refresh token ID
   */
  async findSessionByRefreshToken(refreshTokenId: string) {
    return this.prisma.session.findFirst({
      where: {
        refreshTokenId,
        isActive: true,
        expiresAt: { gt: new Date() },
      },
    });
  }

  /**
   * Cleanup expired sessions (run as cron job)
   * Permanently deletes sessions that are:
   * - Expired (past expiresAt date)
   * - Revoked and older than REVOKED_SESSION_CLEANUP_DAYS
   * - Older than OLD_SESSION_CLEANUP_DAYS (regardless of status)
   */
  async cleanupExpiredSessions(): Promise<number> {
    const now = new Date();
    const revokedCleanupDate = new Date(now.getTime() - REVOKED_SESSION_CLEANUP_DAYS * 24 * 60 * 60 * 1000);
    const oldSessionCleanupDate = new Date(now.getTime() - OLD_SESSION_CLEANUP_DAYS * 24 * 60 * 60 * 1000);

    const result = await this.prisma.session.deleteMany({
      where: {
        OR: [
          // Delete expired sessions
          { expiresAt: { lt: now } },
          // Delete revoked sessions older than cleanup threshold
          {
            AND: [
              { isActive: false },
              { revokedAt: { lt: revokedCleanupDate } },
            ],
          },
          // Delete all sessions older than OLD_SESSION_CLEANUP_DAYS (data retention policy)
          { createdAt: { lt: oldSessionCleanupDate } },
        ],
      },
    });

    return result.count;
  }

  /**
   * Cleanup expired and revoked refresh tokens (run as cron job)
   * Permanently deletes refresh tokens that are:
   * - Expired (past expiresAt date)
   * - Revoked and older than REVOKED_REFRESH_TOKEN_CLEANUP_DAYS
   */
  async cleanupExpiredRefreshTokens(): Promise<number> {
    const now = new Date();
    const revokedCleanupDate = new Date(now.getTime() - REVOKED_REFRESH_TOKEN_CLEANUP_DAYS * 24 * 60 * 60 * 1000);

    const result = await this.prisma.refreshToken.deleteMany({
      where: {
        OR: [
          // Delete expired tokens
          { expiresAt: { lt: now } },
          // Delete revoked tokens older than cleanup threshold
          {
            AND: [
              { isRevoked: true },
              { createdAt: { lt: revokedCleanupDate } },
            ],
          },
        ],
      },
    });

    return result.count;
  }

  /**
   * Get client IP address from request
   */
  private getClientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      const forwardedArray = Array.isArray(forwarded) ? forwarded : forwarded.split(',');
      return forwardedArray[0].trim();
    }

    const realIp = req.headers['x-real-ip'];
    if (realIp) {
      return Array.isArray(realIp) ? realIp[0] : realIp;
    }

    return req.socket.remoteAddress || 'unknown';
  }

  /**
   * Generate device name from user agent
   */
  private getDeviceName(device: UAParser.IResult): string {
    if (device.device.model) {
      return device.device.model;
    }

    const browser = device.browser.name || 'Unknown Browser';
    const os = device.os.name || 'Unknown OS';
    return `${browser} on ${os}`;
  }
}
