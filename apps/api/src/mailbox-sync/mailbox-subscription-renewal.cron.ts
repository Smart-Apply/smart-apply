import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { ConfigService } from '../config/config.service';
import { MailboxConnectionService } from './mailbox-connection.service';

/**
 * Renews Microsoft Graph mail-folder push subscriptions before they expire.
 * Graph caps subscription lifetime at ~70.5h so we run daily and renew any
 * connection whose subscription expires within the configured margin
 * (default 6h). The cron is a no-op when no connection needs renewal —
 * cheap to keep on its 6-hour cadence.
 */
@Injectable()
export class MailboxSubscriptionRenewalCron {
  private readonly logger = new Logger(MailboxSubscriptionRenewalCron.name);

  constructor(
    private readonly connections: MailboxConnectionService,
    private readonly configService: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_6_HOURS, { name: 'mailbox-subscription-renewal' })
  async renewExpiringSubscriptions(): Promise<void> {
    if (!this.configService.enableCronJobs) return;
    if (!this.configService.mailboxSyncEnabled) return;

    const margin = this.configService.mailboxSubscriptionRenewalMarginMinutes;
    const due = await this.connections.listConnectionsToRenew(margin);
    if (due.length === 0) {
      this.logger.debug(`No mailbox subscriptions to renew (margin ${margin}m)`);
      return;
    }

    this.logger.log(`Renewing ${due.length} mailbox subscription(s)`);
    for (const conn of due) {
      try {
        await this.connections.renewSubscription(conn);
      } catch (err) {
        // Service already records the failure on the connection. Just log
        // a summary line at WARN so the issue surfaces in Pino.
        this.logger.warn(
          `Renewal failed for connection ${conn.id} (${conn.emailAddress}): ${(err as Error).message}`,
        );
        await this.connections.markError(conn.id, (err as Error).message);
      }
    }
  }
}
