import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SessionService } from './session.service';

@Injectable()
export class SessionCleanupCron {
  private readonly logger = new Logger(SessionCleanupCron.name);

  constructor(private sessionService: SessionService) {}

  /**
   * Clean up expired sessions daily at 3 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupExpiredSessions() {
    this.logger.log('Starting session cleanup...');
    
    try {
      const count = await this.sessionService.cleanupExpiredSessions();
      this.logger.log(`Session cleanup completed. Cleaned up ${count} expired/revoked sessions.`);
    } catch (error) {
      this.logger.error('Session cleanup failed', error);
    }
  }
}