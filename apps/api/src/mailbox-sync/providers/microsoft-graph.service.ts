import {
  Injectable,
  Logger,
  BadGatewayException,
  ServiceUnavailableException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { ConfigService } from '../../config/config.service';

/**
 * Token-grant response from /oauth2/v2.0/token. We only need a subset.
 */
export interface MsTokenGrant {
  accessToken: string;
  refreshToken: string;
  /** Granted scope string ("Mail.Read offline_access ..."). */
  scope: string;
  /** seconds until accessToken expires */
  expiresIn: number;
}

/**
 * Trimmed Microsoft Graph message we care about for classification.
 * We deliberately do NOT propagate full body HTML/attachments downstream —
 * callers extract a short text snippet for the LLM and discard the rest.
 */
export interface MsGraphMessage {
  id: string;
  subject: string;
  receivedDateTime: string; // ISO
  fromAddress: string;
  fromName?: string;
  /** Best-effort plain-text body. May be empty when the message is an HTML newsletter. */
  bodyPreview: string;
  /** First N chars of the body as plain text (HTML stripped). */
  bodyText: string;
}

export interface MsGraphSubscription {
  id: string;
  expirationDateTime: string;
}

/**
 * Microsoft Graph adapter for the mailbox-sync module.
 *
 * Encapsulates:
 *   - OAuth authorization-code + refresh-token grants
 *   - mailFolders('Inbox')/messages push subscription create/renew/delete
 *   - fetching individual messages by id
 *
 * Uses the global `fetch` (Node 24). We don't add an HTTP client wrapper
 * because each call here has bespoke error handling for Graph error codes.
 */
@Injectable()
export class MicrosoftGraphService {
  private readonly logger = new Logger(MicrosoftGraphService.name);
  private readonly graphBase = 'https://graph.microsoft.com/v1.0';

  // Scopes we request. `offline_access` is REQUIRED to get a refresh token.
  // `Mail.Read` is the minimal scope needed to read message contents.
  // `User.Read` is included so we can identify the connected mailbox address.
  private readonly scopes = ['offline_access', 'Mail.Read', 'User.Read'];

  constructor(private readonly configService: ConfigService) {}

  // ---------------------------------------------------------------------------
  // OAuth
  // ---------------------------------------------------------------------------

  /**
   * Build the consent-screen URL the browser should redirect to. State must
   * be a value the caller can verify on callback (we sign one in the controller).
   */
  buildAuthorizationUrl(state: string): string {
    this.requireOAuthSecrets();
    const params = new URLSearchParams({
      client_id: this.configService.msGraphClientId!,
      response_type: 'code',
      redirect_uri: this.configService.msGraphCallbackUrl,
      response_mode: 'query',
      scope: this.scopes.join(' '),
      state,
      // Force consent so users see exactly which scopes the app gets.
      // Skips the "you've already approved" silent re-grant which is
      // confusing for first-time users.
      prompt: 'consent',
    });

    return `https://login.microsoftonline.com/${this.configService.msGraphTenant}/oauth2/v2.0/authorize?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string): Promise<MsTokenGrant> {
    this.requireOAuthSecrets();
    return this.tokenRequest({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.configService.msGraphCallbackUrl,
      scope: this.scopes.join(' '),
    });
  }

  async refreshAccessToken(refreshToken: string): Promise<MsTokenGrant> {
    this.requireOAuthSecrets();
    return this.tokenRequest({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      scope: this.scopes.join(' '),
    });
  }

  private async tokenRequest(extra: Record<string, string>): Promise<MsTokenGrant> {
    const body = new URLSearchParams({
      client_id: this.configService.msGraphClientId!,
      client_secret: this.configService.msGraphClientSecret!,
      ...extra,
    });

    const url = `https://login.microsoftonline.com/${this.configService.msGraphTenant}/oauth2/v2.0/token`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`Microsoft token endpoint returned ${res.status}: ${text}`);
      throw new BadGatewayException('Microsoft token exchange failed');
    }

    const json = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      scope: string;
    };

    if (!json.refresh_token) {
      // Microsoft only issues a refresh_token when `offline_access` is in the
      // granted scope. If we got here it means the user/admin removed it.
      throw new BadGatewayException(
        'Microsoft did not return a refresh token. Re-consent with offline_access scope.',
      );
    }

    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      scope: json.scope,
      expiresIn: json.expires_in,
    };
  }

  // ---------------------------------------------------------------------------
  // /me/profile
  // ---------------------------------------------------------------------------

  /** Returns the email of the authenticated mailbox. */
  async getMailboxEmail(accessToken: string): Promise<string> {
    const res = await fetch(`${this.graphBase}/me`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      throw new BadGatewayException(`Microsoft Graph /me returned ${res.status}`);
    }
    const json = (await res.json()) as { mail?: string; userPrincipalName?: string };
    const email = json.mail || json.userPrincipalName;
    if (!email) {
      throw new BadGatewayException('Microsoft Graph /me did not return an email');
    }
    return email;
  }

  // ---------------------------------------------------------------------------
  // Subscriptions (push notifications)
  // ---------------------------------------------------------------------------

  /**
   * Create a push subscription on the user's Inbox folder. Microsoft Graph
   * caps subscription lifetime at 4230 minutes (~70.5h) — we ask for the max.
   *
   * `clientState` is echoed back in every notification; we use it to verify
   * the webhook is for one of our connections.
   */
  async createInboxSubscription(args: {
    accessToken: string;
    clientState: string;
  }): Promise<MsGraphSubscription> {
    const expirationDateTime = new Date(Date.now() + 4230 * 60 * 1000).toISOString();

    const res = await fetch(`${this.graphBase}/subscriptions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${args.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        changeType: 'created',
        notificationUrl: this.configService.msGraphWebhookUrl,
        // Resource path: anything new arriving in the Inbox folder.
        resource: "/me/mailFolders('Inbox')/messages",
        expirationDateTime,
        clientState: args.clientState,
        // We never trust delivered payloads; always re-fetch the message
        // ourselves with a fresh access token. Avoids needing `lifecycleNotificationUrl`
        // + the encryption keypair flow that includeResourceData requires.
        includeResourceData: false,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`Failed to create Graph subscription (${res.status}): ${text}`);
      throw new BadGatewayException('Microsoft Graph subscription creation failed');
    }

    const json = (await res.json()) as MsGraphSubscription;
    this.logger.log(
      `Created Graph subscription ${json.id} (expires ${json.expirationDateTime})`,
    );
    return json;
  }

  /** Renew an existing subscription to the maximum allowed expiration. */
  async renewSubscription(args: {
    accessToken: string;
    subscriptionId: string;
  }): Promise<MsGraphSubscription> {
    const expirationDateTime = new Date(Date.now() + 4230 * 60 * 1000).toISOString();

    const res = await fetch(`${this.graphBase}/subscriptions/${args.subscriptionId}`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${args.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ expirationDateTime }),
    });

    if (!res.ok) {
      const text = await res.text();
      this.logger.warn(`Failed to renew Graph subscription ${args.subscriptionId}: ${text}`);
      throw new BadGatewayException('Microsoft Graph subscription renewal failed');
    }

    return (await res.json()) as MsGraphSubscription;
  }

  /** Best-effort delete; Graph already prunes expired subs after a grace period. */
  async deleteSubscription(args: {
    accessToken: string;
    subscriptionId: string;
  }): Promise<void> {
    try {
      await fetch(`${this.graphBase}/subscriptions/${args.subscriptionId}`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${args.accessToken}` },
      });
    } catch (err) {
      // Don't throw — we want disconnect to succeed even if Graph is down.
      this.logger.warn(`Subscription delete failed (best-effort): ${(err as Error).message}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Messages
  // ---------------------------------------------------------------------------

  /**
   * Fetch a single message by id. Returns a normalized shape with a short
   * plain-text body suitable for LLM classification. We never persist the
   * full body — the orchestrator passes the snippet to the classifier and
   * then drops it.
   */
  async fetchMessage(args: {
    accessToken: string;
    messageId: string;
    bodyMaxChars?: number;
  }): Promise<MsGraphMessage> {
    const select = ['id', 'subject', 'from', 'receivedDateTime', 'bodyPreview', 'body'].join(',');
    const url = `${this.graphBase}/me/messages/${encodeURIComponent(args.messageId)}?$select=${select}`;

    const res = await fetch(url, {
      headers: { authorization: `Bearer ${args.accessToken}` },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new BadGatewayException(
        `Microsoft Graph message fetch failed (${res.status}): ${text.slice(0, 200)}`,
      );
    }

    const json = (await res.json()) as {
      id: string;
      subject?: string;
      from?: { emailAddress?: { address?: string; name?: string } };
      receivedDateTime: string;
      bodyPreview?: string;
      body?: { contentType: 'text' | 'html'; content: string };
    };

    const fromAddress = json.from?.emailAddress?.address ?? 'unknown@unknown';
    const fromName = json.from?.emailAddress?.name;
    const subject = (json.subject ?? '').slice(0, 500);
    const bodyText = htmlToPlainText(json.body?.content ?? '', json.body?.contentType ?? 'text');
    const cap = args.bodyMaxChars ?? 4000;

    return {
      id: json.id,
      subject,
      receivedDateTime: json.receivedDateTime,
      fromAddress,
      fromName,
      bodyPreview: (json.bodyPreview ?? '').slice(0, 500),
      bodyText: bodyText.slice(0, cap),
    };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /** Generate a webhook clientState (random secret per connection). */
  static newClientState(): string {
    return crypto.randomBytes(24).toString('base64url');
  }

  private requireOAuthSecrets(): void {
    if (!this.configService.msGraphClientId || !this.configService.msGraphClientSecret) {
      throw new ServiceUnavailableException(
        'Microsoft inbox sync is not configured (MS_GRAPH_CLIENT_ID/SECRET missing).',
      );
    }
  }
}

/**
 * Convert an HTML email body to plain text suitable for LLM classification.
 * Intentionally simple — strips tags + collapses whitespace. We don't need
 * full Markdown fidelity, just enough for the classifier prompt.
 */
function htmlToPlainText(content: string, contentType: 'text' | 'html'): string {
  if (!content) return '';
  if (contentType === 'text') return content;
  return content
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>(\r?\n)?/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/[\t ]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
