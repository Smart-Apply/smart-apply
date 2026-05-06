import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { PrismaModule } from '../prisma/prisma.module';
import { LLMModule } from '../llm/llm.module';
import { ConfigModule } from '../config/config.module';

import { TokenCipher } from './utils/token-cipher';
import { MicrosoftGraphService } from './providers/microsoft-graph.service';
import { MailboxConnectionService } from './mailbox-connection.service';
import { MailboxMatcherService } from './mailbox-matcher.service';
import { EmailClassifierService } from './email-classifier.service';
import { MailboxSyncOrchestrator } from './mailbox-sync.orchestrator';
import { MailboxConnectionController } from './mailbox-connection.controller';
import { MailboxWebhookController } from './mailbox-webhook.controller';
import { MailboxSubscriptionRenewalCron } from './mailbox-subscription-renewal.cron';

/**
 * Email Tracking (Premium feature).
 *
 * Connects external mailboxes (Microsoft 365 / Outlook.com first; Gmail
 * later) over OAuth and turns inbound emails from companies into automatic
 * application-status updates.
 *
 * EmailModule is @Global() so we don't import it explicitly. SubscriptionService
 * (used by FeatureGuard) is registered globally via SubscriptionModule.
 */
@Module({
  imports: [PrismaModule, LLMModule, ConfigModule, ScheduleModule.forRoot()],
  controllers: [MailboxConnectionController, MailboxWebhookController],
  providers: [
    TokenCipher,
    MicrosoftGraphService,
    MailboxConnectionService,
    MailboxMatcherService,
    EmailClassifierService,
    MailboxSyncOrchestrator,
    MailboxSubscriptionRenewalCron,
  ],
})
export class MailboxSyncModule {}
