import { Injectable, Logger } from '@nestjs/common';
import {
  ApplicationStatusSource,
  ApplicationTrackingStatus,
  EmailClassification,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { MailboxConnectionService } from './mailbox-connection.service';
import {
  EmailClassifierService,
  MIN_CONFIDENCE_FOR_STATUS_CHANGE,
} from './email-classifier.service';
import { MailboxMatcherService } from './mailbox-matcher.service';
import { MicrosoftGraphService } from './providers/microsoft-graph.service';

/**
 * End-to-end pipeline for one inbound email notification:
 *   1. fetch the message from the provider with a fresh access token
 *   2. classify it with the LLM
 *   3. match it to one of the user's recent applications (heuristic, no LLM)
 *   4. persist an `ApplicationEmailEvent` audit row (always)
 *   5. only when classifier + matcher are BOTH confident AND the suggested
 *      status differs from the current one — flip the status and (optionally)
 *      send the user a notification email.
 *
 * The orchestrator is the only place that writes
 * `Application.statusSource = EMAIL_TRACKING`. Everything else (manual UI
 * updates, generation pipeline) writes USER or SYSTEM. This is what guards
 * the "only notify on tracking-driven changes" rule from the requirements.
 */
@Injectable()
export class MailboxSyncOrchestrator {
  private readonly logger = new Logger(MailboxSyncOrchestrator.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly connections: MailboxConnectionService,
    private readonly graph: MicrosoftGraphService,
    private readonly classifier: EmailClassifierService,
    private readonly matcher: MailboxMatcherService,
    private readonly email: EmailService,
  ) {}

  /**
   * Process one Microsoft Graph notification entry. Resilient by design —
   * if any step fails we record the failure on the connection and return.
   * Webhook controller never gets to see exceptions (Graph would consider
   * non-2xx responses as delivery failures and retry).
   */
  async processMicrosoftNotification(args: {
    subscriptionId: string;
    clientState: string;
    /** Graph resource path, e.g. "Users/.../Messages/AAMkAGZ..." */
    resource: string;
  }): Promise<void> {
    const conn = await this.connections.findBySubscriptionId(args.subscriptionId);
    if (!conn) {
      this.logger.warn(
        `Notification for unknown subscription ${args.subscriptionId} — ignoring`,
      );
      return;
    }
    if (conn.webhookClientState !== args.clientState) {
      this.logger.error(
        `clientState mismatch for subscription ${args.subscriptionId} — possible spoofing attempt`,
      );
      return;
    }

    const messageId = extractMessageId(args.resource);
    if (!messageId) {
      this.logger.warn(`Could not extract message id from resource path: ${args.resource}`);
      return;
    }

    // Dedupe replays of the same notification. Graph occasionally re-delivers.
    const existing = await this.prisma.applicationEmailEvent.findUnique({
      where: {
        mailboxConnectionId_providerMessageId: {
          mailboxConnectionId: conn.id,
          providerMessageId: messageId,
        },
      },
    });
    if (existing) {
      this.logger.debug(`Skipping duplicate notification for message ${messageId}`);
      return;
    }

    try {
      const accessToken = await this.connections.getFreshAccessToken(conn);
      const message = await this.graph.fetchMessage({ accessToken, messageId });

      const classification = await this.classifier.classify({
        subject: message.subject,
        fromAddress: message.fromAddress,
        bodyText: message.bodyText,
      });

      const match = await this.matcher.match(conn.userId, {
        subject: message.subject,
        fromAddress: message.fromAddress,
        fromName: message.fromName,
        bodyText: message.bodyText,
      });

      // Decide whether to mutate state. Three gates must all pass:
      //   (a) classifier confidence above threshold
      //   (b) classifier returned a concrete status mapping (not OTHER / REQUEST_FOR_INFO)
      //   (c) matcher linked the email to an application
      const shouldFlipStatus =
        match !== null &&
        classification.suggestedStatus !== null &&
        classification.confidence >= MIN_CONFIDENCE_FOR_STATUS_CHANGE;

      let resultedInStatusChange = false;
      let previousStatus: ApplicationTrackingStatus | null = null;
      let newStatus: ApplicationTrackingStatus | null = null;
      let notificationSent = false;

      if (shouldFlipStatus && match) {
        const updated = await this.flipApplicationStatus({
          applicationId: match.applicationId,
          newStatus: classification.suggestedStatus!,
        });
        previousStatus = updated.previousStatus;
        newStatus = updated.newStatus;
        resultedInStatusChange = updated.changed;

        if (resultedInStatusChange && newStatus) {
          notificationSent = await this.maybeNotifyUser({
            userId: conn.userId,
            applicationId: match.applicationId,
            previousStatus,
            newStatus,
            mailFromAddress: message.fromAddress,
            mailSubject: message.subject,
            mailReceivedAt: message.receivedDateTime,
          });
        }
      }

      await this.prisma.applicationEmailEvent.create({
        data: {
          mailboxConnectionId: conn.id,
          applicationId: match?.applicationId ?? null,
          providerMessageId: messageId,
          fromAddress: message.fromAddress.slice(0, 320),
          fromName: message.fromName?.slice(0, 200) ?? null,
          subject: message.subject,
          receivedAt: new Date(message.receivedDateTime),
          classification: classification.classification,
          confidence: classification.confidence,
          classifierModel: classification.model,
          resultedInStatusChange,
          previousStatus: previousStatus ?? undefined,
          newStatus: newStatus ?? undefined,
          notificationSent,
          reason: buildReason(classification.reason, match?.matchReason),
        },
      });

      await this.connections.markHealthy(conn.id);
    } catch (err) {
      const msg = (err as Error).message;
      this.logger.error(
        `Failed processing message ${messageId} for connection ${conn.id}: ${msg}`,
      );
      await this.connections.markError(conn.id, msg);
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private async flipApplicationStatus(args: {
    applicationId: string;
    newStatus: ApplicationTrackingStatus;
  }): Promise<{
    previousStatus: ApplicationTrackingStatus;
    newStatus: ApplicationTrackingStatus;
    changed: boolean;
  }> {
    const app = await this.prisma.application.findUnique({
      where: { id: args.applicationId },
      select: { applicationStatus: true },
    });
    if (!app) {
      // Race: app was deleted between matching and update.
      return {
        previousStatus: ApplicationTrackingStatus.CREATED,
        newStatus: args.newStatus,
        changed: false,
      };
    }
    if (app.applicationStatus === args.newStatus) {
      return {
        previousStatus: app.applicationStatus,
        newStatus: args.newStatus,
        changed: false,
      };
    }

    await this.prisma.application.update({
      where: { id: args.applicationId },
      data: {
        applicationStatus: args.newStatus,
        statusUpdatedAt: new Date(),
        statusSource: ApplicationStatusSource.EMAIL_TRACKING,
      },
    });

    return {
      previousStatus: app.applicationStatus,
      newStatus: args.newStatus,
      changed: true,
    };
  }

  /**
   * Send the user a "we updated your status" mail — only when:
   *   - they have email-tracking notifications enabled in UserPreferences
   *   - we can resolve the application's job posting (for context)
   * Returns true on a successful send (or a successful "logged but not sent"
   * dev-mode dry-run); false on hard failures.
   */
  private async maybeNotifyUser(args: {
    userId: string;
    applicationId: string;
    previousStatus: ApplicationTrackingStatus | null;
    newStatus: ApplicationTrackingStatus;
    mailFromAddress: string;
    mailSubject: string;
    mailReceivedAt: string;
  }): Promise<boolean> {
    const [user, prefs, app] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: args.userId },
        select: { email: true, firstName: true },
      }),
      this.prisma.userPreferences.findUnique({
        where: { userId: args.userId },
        select: { emailTrackingNotify: true, applicationUpdates: true },
      }),
      this.prisma.application.findUnique({
        where: { id: args.applicationId },
        select: { title: true, jobPosting: { select: { title: true, company: true } } },
      }),
    ]);

    if (!user?.email) return false;
    // Default to ON when the prefs row is missing (legacy users created
    // before the column existed default to true via the schema, but be safe).
    const notifyEnabled = prefs?.emailTrackingNotify ?? true;
    if (!notifyEnabled) return false;
    if (!app) return false;

    const newPill = STATUS_PILL[args.newStatus];
    const prevLabel = args.previousStatus
      ? STATUS_PILL[args.previousStatus].label
      : '—';

    return this.email.sendApplicationStatusChangedEmail({
      to: user.email,
      firstName: user.firstName,
      applicationId: args.applicationId,
      applicationTitle:
        app.title ?? `${app.jobPosting?.title ?? 'Bewerbung'} @ ${app.jobPosting?.company ?? ''}`,
      jobTitle: app.jobPosting?.title ?? 'Position',
      company: app.jobPosting?.company ?? '',
      previousStatusLabel: prevLabel,
      newStatusLabel: newPill.label,
      newStatusBg: newPill.bg,
      newStatusFg: newPill.fg,
      fromAddress: args.mailFromAddress,
      subject: args.mailSubject,
      receivedAtLabel: new Date(args.mailReceivedAt).toLocaleString('de-DE'),
    });
  }
}

/** Mapping from Graph notification resource path to the message id. */
function extractMessageId(resource: string): string | null {
  // Examples observed in the wild:
  //   "Users/24..../Messages/AAMkADk0..."
  //   "users('me')/messages('AAMkADk0...')"
  //   "Users/24..../mailFolders('Inbox')/Messages/AAMkADk0..."
  const match =
    resource.match(/Messages\/([^/?']+)/i) ||
    resource.match(/messages\(['"]([^'"]+)['"]\)/i);
  return match?.[1] ?? null;
}

function buildReason(classifierReason: string, matcherReason?: string): string {
  const parts: string[] = [];
  if (classifierReason) parts.push(`classifier: ${classifierReason}`);
  if (matcherReason) parts.push(`match: ${matcherReason}`);
  return parts.join(' · ').slice(0, 1000);
}

/**
 * Visual mapping for the notification email pills. Mirrors the
 * status-dropdown component on the frontend so emails look on-brand.
 */
const STATUS_PILL: Record<
  ApplicationTrackingStatus,
  { label: string; bg: string; fg: string }
> = {
  CREATED: { label: 'Erstellt', bg: '#e5e7eb', fg: '#374151' },
  APPLIED: { label: 'Beworben', bg: '#dbeafe', fg: '#1e40af' },
  INTERVIEW: { label: 'Interview', bg: '#fef3c7', fg: '#92400e' },
  ACCEPTED: { label: 'Angenommen', bg: '#dcfce7', fg: '#166534' },
  REJECTED: { label: 'Abgelehnt', bg: '#fee2e2', fg: '#991b1b' },
};

// Re-export for tests
export { extractMessageId };
// Suppress unused-import warning for the enum type when none of the code
// paths above happens to reference it directly.
export type _EmailClassification = EmailClassification;
