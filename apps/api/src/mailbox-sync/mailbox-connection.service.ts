import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  MailboxConnection,
  MailboxConnectionStatus,
  MailboxProvider,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '../config/config.service';
import { TokenCipher } from './utils/token-cipher';
import {
  MicrosoftGraphService,
  MsTokenGrant,
} from './providers/microsoft-graph.service';

/**
 * CRUD + lifecycle for `mailbox_connections`. The orchestrator and webhook
 * controller talk to this service; provider-specific HTTP lives in
 * MicrosoftGraphService.
 */
@Injectable()
export class MailboxConnectionService {
  private readonly logger = new Logger(MailboxConnectionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly cipher: TokenCipher,
    private readonly graph: MicrosoftGraphService,
  ) {}

  // ---------------------------------------------------------------------------
  // List / get
  // ---------------------------------------------------------------------------

  async listForUser(userId: string): Promise<MailboxConnection[]> {
    return this.prisma.mailboxConnection.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findBySubscriptionId(subscriptionId: string): Promise<MailboxConnection | null> {
    return this.prisma.mailboxConnection.findUnique({ where: { subscriptionId } });
  }

  async getByIdForUser(id: string, userId: string): Promise<MailboxConnection> {
    const conn = await this.prisma.mailboxConnection.findUnique({ where: { id } });
    if (!conn || conn.userId !== userId) {
      throw new NotFoundException('Mailbox connection not found');
    }
    return conn;
  }

  // ---------------------------------------------------------------------------
  // Connect (called from OAuth callback)
  // ---------------------------------------------------------------------------

  /**
   * Persist a new connection from a freshly-completed OAuth round trip.
   * Creates the Microsoft Graph push subscription before returning. If
   * subscription creation fails we still write the row so the renewal cron
   * can retry — but flag it as ERROR so the UI surfaces the issue.
   */
  async createMicrosoftConnection(args: {
    userId: string;
    grant: MsTokenGrant;
  }): Promise<MailboxConnection> {
    if (!this.configService.mailboxSyncEnabled) {
      throw new ServiceUnavailableException('Email tracking is not enabled on this server.');
    }

    const existing = await this.prisma.mailboxConnection.findUnique({
      where: {
        userId_provider: { userId: args.userId, provider: MailboxProvider.MICROSOFT },
      },
    });
    if (existing && existing.status !== MailboxConnectionStatus.DISABLED) {
      // Re-consent flow: refresh the stored token, recreate the subscription.
      return this.refreshExistingConnection(existing, args.grant);
    }

    const emailAddress = await this.graph.getMailboxEmail(args.grant.accessToken);
    const clientState = MicrosoftGraphService.newClientState();

    let subscriptionId: string | undefined;
    let subscriptionExpiresAt: Date | undefined;
    let initialStatus: MailboxConnectionStatus = MailboxConnectionStatus.ACTIVE;
    let initialError: string | null = null;

    try {
      const sub = await this.graph.createInboxSubscription({
        accessToken: args.grant.accessToken,
        clientState,
      });
      subscriptionId = sub.id;
      subscriptionExpiresAt = new Date(sub.expirationDateTime);
    } catch (err) {
      // Persist the row anyway; renewal cron will retry.
      initialStatus = MailboxConnectionStatus.ERROR;
      initialError = (err as Error).message;
      this.logger.warn(
        `Created mailbox connection for ${emailAddress} without subscription: ${initialError}`,
      );
    }

    const enc = this.cipher.encrypt(args.grant.refreshToken);

    if (existing) {
      // DISABLED row exists — re-activate it instead of inserting (unique
      // constraint on (userId, provider) would reject otherwise).
      return this.prisma.mailboxConnection.update({
        where: { id: existing.id },
        data: {
          status: initialStatus,
          emailAddress,
          refreshTokenCiphertext: enc.ciphertext,
          refreshTokenIv: enc.iv,
          refreshTokenAuthTag: enc.authTag,
          scope: args.grant.scope,
          subscriptionId,
          subscriptionExpiresAt,
          webhookClientState: clientState,
          lastSyncedAt: null,
          lastErrorAt: initialError ? new Date() : null,
          lastErrorMessage: initialError,
          consecutiveErrors: initialError ? 1 : 0,
        },
      });
    }

    return this.prisma.mailboxConnection.create({
      data: {
        userId: args.userId,
        provider: MailboxProvider.MICROSOFT,
        status: initialStatus,
        emailAddress,
        refreshTokenCiphertext: enc.ciphertext,
        refreshTokenIv: enc.iv,
        refreshTokenAuthTag: enc.authTag,
        scope: args.grant.scope,
        subscriptionId,
        subscriptionExpiresAt,
        webhookClientState: clientState,
        lastErrorAt: initialError ? new Date() : null,
        lastErrorMessage: initialError,
        consecutiveErrors: initialError ? 1 : 0,
      },
    });
  }

  /**
   * Re-consent or token-rotation: update the stored refresh token and
   * recreate the subscription against the new token. Old subscription is
   * deleted best-effort.
   */
  private async refreshExistingConnection(
    existing: MailboxConnection,
    grant: MsTokenGrant,
  ): Promise<MailboxConnection> {
    if (existing.subscriptionId) {
      await this.graph.deleteSubscription({
        accessToken: grant.accessToken,
        subscriptionId: existing.subscriptionId,
      });
    }

    const clientState = MicrosoftGraphService.newClientState();
    const sub = await this.graph.createInboxSubscription({
      accessToken: grant.accessToken,
      clientState,
    });
    const enc = this.cipher.encrypt(grant.refreshToken);
    const emailAddress = await this.graph.getMailboxEmail(grant.accessToken);

    return this.prisma.mailboxConnection.update({
      where: { id: existing.id },
      data: {
        status: MailboxConnectionStatus.ACTIVE,
        emailAddress,
        refreshTokenCiphertext: enc.ciphertext,
        refreshTokenIv: enc.iv,
        refreshTokenAuthTag: enc.authTag,
        scope: grant.scope,
        subscriptionId: sub.id,
        subscriptionExpiresAt: new Date(sub.expirationDateTime),
        webhookClientState: clientState,
        lastErrorAt: null,
        lastErrorMessage: null,
        consecutiveErrors: 0,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Disconnect
  // ---------------------------------------------------------------------------

  /**
   * Revoke the Microsoft Graph subscription (best-effort) and remove the
   * connection row. We do NOT keep DISABLED rows around — the user
   * explicitly asked to disconnect, and keeping encrypted tokens we don't
   * need increases blast radius for nothing.
   */
  async disconnect(userId: string, id: string): Promise<void> {
    const conn = await this.getByIdForUser(id, userId);

    if (conn.subscriptionId && conn.provider === MailboxProvider.MICROSOFT) {
      try {
        const accessToken = await this.getFreshAccessToken(conn);
        await this.graph.deleteSubscription({
          accessToken,
          subscriptionId: conn.subscriptionId,
        });
      } catch (err) {
        // Don't block disconnect on a failing token refresh — Graph will
        // expire the subscription on its own within ~3 days.
        this.logger.warn(
          `Subscription cleanup failed for ${conn.id}: ${(err as Error).message}`,
        );
      }
    }

    await this.prisma.mailboxConnection.delete({ where: { id: conn.id } });
  }

  // ---------------------------------------------------------------------------
  // Token / state helpers
  // ---------------------------------------------------------------------------

  /**
   * Decrypt the refresh token, hit the token endpoint, and return a usable
   * access token. Persists the new refresh token if the provider rotated it
   * (Microsoft frequently does).
   */
  async getFreshAccessToken(conn: MailboxConnection): Promise<string> {
    const refreshToken = this.cipher.decrypt({
      ciphertext: conn.refreshTokenCiphertext,
      iv: conn.refreshTokenIv,
      authTag: conn.refreshTokenAuthTag,
    });

    const grant = await this.graph.refreshAccessToken(refreshToken);

    if (grant.refreshToken && grant.refreshToken !== refreshToken) {
      const enc = this.cipher.encrypt(grant.refreshToken);
      await this.prisma.mailboxConnection.update({
        where: { id: conn.id },
        data: {
          refreshTokenCiphertext: enc.ciphertext,
          refreshTokenIv: enc.iv,
          refreshTokenAuthTag: enc.authTag,
        },
      });
    }
    return grant.accessToken;
  }

  async markError(connId: string, message: string): Promise<void> {
    const conn = await this.prisma.mailboxConnection.findUnique({ where: { id: connId } });
    if (!conn) return;
    const next = conn.consecutiveErrors + 1;
    await this.prisma.mailboxConnection.update({
      where: { id: connId },
      data: {
        lastErrorAt: new Date(),
        lastErrorMessage: message.slice(0, 500),
        consecutiveErrors: next,
        // After 5 consecutive failures, mark the connection as ERROR so the
        // UI shows it and the renewal cron stops retrying every hour.
        status: next >= 5 ? MailboxConnectionStatus.ERROR : conn.status,
      },
    });
  }

  async markHealthy(connId: string): Promise<void> {
    await this.prisma.mailboxConnection.update({
      where: { id: connId },
      data: {
        lastSyncedAt: new Date(),
        consecutiveErrors: 0,
        lastErrorAt: null,
        lastErrorMessage: null,
        status: MailboxConnectionStatus.ACTIVE,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Subscription renewal (called from cron)
  // ---------------------------------------------------------------------------

  async listConnectionsToRenew(marginMinutes: number): Promise<MailboxConnection[]> {
    const renewBefore = new Date(Date.now() + marginMinutes * 60_000);
    return this.prisma.mailboxConnection.findMany({
      where: {
        status: MailboxConnectionStatus.ACTIVE,
        subscriptionId: { not: null },
        subscriptionExpiresAt: { lte: renewBefore },
      },
    });
  }

  async renewSubscription(conn: MailboxConnection): Promise<void> {
    if (!conn.subscriptionId) {
      throw new ConflictException('Connection has no Graph subscription to renew');
    }
    const accessToken = await this.getFreshAccessToken(conn);
    const sub = await this.graph.renewSubscription({
      accessToken,
      subscriptionId: conn.subscriptionId,
    });
    await this.prisma.mailboxConnection.update({
      where: { id: conn.id },
      data: { subscriptionExpiresAt: new Date(sub.expirationDateTime) },
    });
  }
}
