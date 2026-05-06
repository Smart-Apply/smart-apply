import {
  Controller,
  Post,
  Query,
  Body,
  Headers,
  Logger,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiExcludeEndpoint } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Response } from 'express';

import { MailboxSyncOrchestrator } from './mailbox-sync.orchestrator';

interface GraphChangeNotification {
  subscriptionId: string;
  clientState?: string;
  resource: string;
  changeType: string;
  resourceData?: { id?: string };
}

interface GraphWebhookBody {
  value: GraphChangeNotification[];
}

/**
 * Public webhook for Microsoft Graph push notifications. Two responsibilities:
 *
 * 1) Validation handshake — when Graph creates a subscription it sends a
 *    GET-or-POST with `?validationToken=...`. We MUST echo the token back
 *    as plain text within 10 seconds, otherwise the subscription is rejected.
 *
 * 2) Change notifications — POST { value: [...] } with one or more
 *    notification entries. We respond 202 immediately and process the
 *    notifications in the background; if processing fails Graph will retry
 *    the SAME notification with the SAME messageId, which our orchestrator
 *    dedupes via the (mailboxConnectionId, providerMessageId) unique index.
 *
 * IMPORTANT: this endpoint must NOT require auth and must NOT be CSRF-checked.
 * We verify legitimacy with the per-connection `clientState` secret stored
 * in `mailbox_connections`.
 */
@ApiTags('Email Tracking')
@Controller('mailbox-sync/microsoft')
export class MailboxWebhookController {
  private readonly logger = new Logger(MailboxWebhookController.name);

  constructor(private readonly orchestrator: MailboxSyncOrchestrator) {}

  @Post('webhook')
  @SkipThrottle() // legitimate Graph traffic far exceeds throttle limits
  @ApiExcludeEndpoint() // no point documenting in Swagger — Microsoft is the only caller
  @ApiOperation({ summary: 'Microsoft Graph push notification webhook' })
  async handle(
    @Query('validationToken') validationToken: string | undefined,
    @Body() body: GraphWebhookBody | undefined,
    @Headers('content-type') _contentType: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    // (1) Subscription-creation handshake.
    if (validationToken) {
      // Must be plain text, 200, body = the raw token. No JSON.
      res.status(HttpStatus.OK).type('text/plain').send(validationToken);
      return;
    }

    // (2) Change notifications.
    if (!body || !Array.isArray(body.value)) {
      // Empty / malformed body — ack with 202 so Graph doesn't retry.
      res.status(HttpStatus.ACCEPTED).send();
      return;
    }

    // ACK fast: kick off processing without awaiting it. Graph times out at
    // ~30s and we don't want LLM latency to make it think we're down.
    res.status(HttpStatus.ACCEPTED).send();

    // Process each notification. We deliberately await each in sequence —
    // the LLM and Graph token endpoint are both global rate-limited and
    // serial processing keeps backpressure manageable.
    for (const note of body.value) {
      try {
        await this.orchestrator.processMicrosoftNotification({
          subscriptionId: note.subscriptionId,
          clientState: note.clientState ?? '',
          resource: note.resource,
        });
      } catch (err) {
        // Orchestrator already logs + records errors on the connection;
        // catching here just prevents one bad note from killing the loop.
        this.logger.error(
          `Unhandled error processing Graph notification: ${(err as Error).message}`,
        );
      }
    }
  }
}
