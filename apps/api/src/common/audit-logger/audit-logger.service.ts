import { Injectable } from '@nestjs/common';
import { createLogger, format, transports } from 'winston';
import * as DailyRotateFile from 'winston-daily-rotate-file';
import { Request } from 'express';

export enum AuditEventType {
  // Authentication
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILED = 'LOGIN_FAILED',
  LOGOUT = 'LOGOUT',
  REGISTRATION = 'REGISTRATION',
  PASSWORD_RESET = 'PASSWORD_RESET',
  REFRESH_TOKEN_USED = 'REFRESH_TOKEN_USED',

  // Security
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  CSRF_VALIDATION_FAILED = 'CSRF_VALIDATION_FAILED',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',

  // Account Changes
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',
  EMAIL_CHANGED = 'EMAIL_CHANGED',
  PROFILE_UPDATED = 'PROFILE_UPDATED',

  // Suspicious Activity
  MULTIPLE_FAILED_LOGINS = 'MULTIPLE_FAILED_LOGINS',
  IP_CHANGE_DETECTED = 'IP_CHANGE_DETECTED',
}

export interface AuditLogEntry {
  eventType: AuditEventType;
  userId?: string;
  email?: string;
  ip: string;
  userAgent: string;
  timestamp: Date;
  metadata?: Record<string, any>;
  severity: 'info' | 'warning' | 'critical';
}

@Injectable()
export class AuditLoggerService {
  private logger = createLogger({
    format: format.combine(format.timestamp(), format.json()),
    transports: [
      // Daily rotating file for audit logs
      new DailyRotateFile({
        filename: 'logs/audit-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '90d', // Keep 90 days
        level: 'info',
      }),
      // Console in development
      ...(process.env.NODE_ENV === 'development'
        ? [
            new transports.Console({
              format: format.combine(format.colorize(), format.simple()),
            }),
          ]
        : []),
    ],
  });

  log(entry: AuditLogEntry) {
    this.logger.log({
      level: entry.severity,
      message: entry.eventType,
      ...entry,
    });
  }

  logLoginAttempt(email: string, success: boolean, req: Request, userId?: string) {
    this.log({
      eventType: success ? AuditEventType.LOGIN_SUCCESS : AuditEventType.LOGIN_FAILED,
      email,
      userId,
      ip: this.getClientIp(req),
      userAgent: req.headers['user-agent'] || 'unknown',
      timestamp: new Date(),
      severity: success ? 'info' : 'warning',
      metadata: { success },
    });
  }

  logRegistration(email: string, userId: string, req: Request) {
    this.log({
      eventType: AuditEventType.REGISTRATION,
      email,
      userId,
      ip: this.getClientIp(req),
      userAgent: req.headers['user-agent'] || 'unknown',
      timestamp: new Date(),
      severity: 'info',
    });
  }

  logLogout(userId: string, req: Request) {
    this.log({
      eventType: AuditEventType.LOGOUT,
      userId,
      ip: this.getClientIp(req),
      userAgent: req.headers['user-agent'] || 'unknown',
      timestamp: new Date(),
      severity: 'info',
    });
  }

  logRefreshTokenUsed(userId: string, email: string, req: Request) {
    this.log({
      eventType: AuditEventType.REFRESH_TOKEN_USED,
      userId,
      email,
      ip: this.getClientIp(req),
      userAgent: req.headers['user-agent'] || 'unknown',
      timestamp: new Date(),
      severity: 'info',
    });
  }

  logRateLimitViolation(userId: string | undefined, endpoint: string, req: Request) {
    this.log({
      eventType: AuditEventType.RATE_LIMIT_EXCEEDED,
      userId,
      ip: this.getClientIp(req),
      userAgent: req.headers['user-agent'] || 'unknown',
      timestamp: new Date(),
      severity: 'warning',
      metadata: { endpoint },
    });
  }

  logCsrfValidationFailed(userId: string | undefined, req: Request) {
    this.log({
      eventType: AuditEventType.CSRF_VALIDATION_FAILED,
      userId,
      ip: this.getClientIp(req),
      userAgent: req.headers['user-agent'] || 'unknown',
      timestamp: new Date(),
      severity: 'warning',
      metadata: {
        method: req.method,
        url: req.url,
      },
    });
  }

  logUnauthorizedAccess(userId: string | undefined, endpoint: string, req: Request) {
    this.log({
      eventType: AuditEventType.UNAUTHORIZED_ACCESS,
      userId,
      ip: this.getClientIp(req),
      userAgent: req.headers['user-agent'] || 'unknown',
      timestamp: new Date(),
      severity: 'warning',
      metadata: { endpoint },
    });
  }

  logPasswordChange(userId: string, req: Request) {
    this.log({
      eventType: AuditEventType.PASSWORD_CHANGED,
      userId,
      ip: this.getClientIp(req),
      userAgent: req.headers['user-agent'] || 'unknown',
      timestamp: new Date(),
      severity: 'info',
    });
  }

  logProfileUpdate(userId: string, req: Request, metadata?: Record<string, any>) {
    this.log({
      eventType: AuditEventType.PROFILE_UPDATED,
      userId,
      ip: this.getClientIp(req),
      userAgent: req.headers['user-agent'] || 'unknown',
      timestamp: new Date(),
      severity: 'info',
      metadata,
    });
  }

  private getClientIp(req: any): string {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      req.headers['x-real-ip'] ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      req.ip ||
      'unknown'
    );
  }
}
