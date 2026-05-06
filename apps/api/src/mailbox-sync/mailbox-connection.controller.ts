import {
  Controller,
  Get,
  Delete,
  Param,
  Query,
  Res,
  Logger,
  UseGuards,
  ServiceUnavailableException,
  BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import * as crypto from 'crypto';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { FeatureGuard } from '../common/guards/feature.guard';
import { RequiresFeature } from '../common/decorators/tier.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ConfigService } from '../config/config.service';

import { MailboxConnectionService } from './mailbox-connection.service';
import { MicrosoftGraphService } from './providers/microsoft-graph.service';
import {
  MailboxConnectionDto,
  ConnectMailboxResponseDto,
} from './dto/mailbox-connection.dto';

interface OAuthState {
  uid: string; // user id
  n: string; // nonce
}

/**
 * Controllers exposed to the authenticated frontend:
 *   GET    /mailbox-sync/connections                — list connected mailboxes
 *   GET    /mailbox-sync/microsoft/connect          — kick off OAuth, returns redirect URL
 *   GET    /mailbox-sync/microsoft/callback         — OAuth redirect target (browser nav)
 *   DELETE /mailbox-sync/connections/:id            — disconnect a mailbox
 *
 * The webhook for Microsoft Graph notifications lives on a separate
 * controller because it MUST stay public + skip JWT.
 */
@ApiTags('Email Tracking')
@ApiBearerAuth()
@Controller('mailbox-sync')
export class MailboxConnectionController {
  private readonly logger = new Logger(MailboxConnectionController.name);

  constructor(
    private readonly connections: MailboxConnectionService,
    private readonly graph: MicrosoftGraphService,
    private readonly configService: ConfigService,
  ) {}

  // ---------------------------------------------------------------------------
  // List connections
  // ---------------------------------------------------------------------------

  @Get('connections')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @RequiresFeature('emailParsing')
  @ApiOperation({ summary: 'List the user’s connected mailboxes' })
  @ApiResponse({ status: 200, type: [MailboxConnectionDto] })
  async list(@CurrentUser() user: { id: string }): Promise<MailboxConnectionDto[]> {
    const rows = await this.connections.listForUser(user.id);
    return rows.map((c) => ({
      id: c.id,
      provider: c.provider,
      status: c.status,
      emailAddress: c.emailAddress,
      lastSyncedAt: c.lastSyncedAt?.toISOString(),
      lastErrorMessage: c.lastErrorMessage,
      subscriptionExpiresAt: c.subscriptionExpiresAt?.toISOString(),
      createdAt: c.createdAt.toISOString(),
    }));
  }

  // ---------------------------------------------------------------------------
  // Microsoft OAuth — initiate
  // ---------------------------------------------------------------------------

  @Get('microsoft/connect')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @RequiresFeature('emailParsing')
  @ApiOperation({
    summary: 'Initiate the Microsoft OAuth flow for inbox sync',
    description:
      'Returns the URL the browser should redirect to. After consent, Microsoft redirects to /mailbox-sync/microsoft/callback.',
  })
  @ApiResponse({ status: 200, type: ConnectMailboxResponseDto })
  initiateMicrosoft(@CurrentUser() user: { id: string }): ConnectMailboxResponseDto {
    if (!this.configService.mailboxSyncEnabled) {
      throw new ServiceUnavailableException('Email tracking is not enabled on this server.');
    }
    const state = this.signState({ uid: user.id, n: crypto.randomBytes(8).toString('hex') });
    return { authorizationUrl: this.graph.buildAuthorizationUrl(state) };
  }

  // ---------------------------------------------------------------------------
  // Microsoft OAuth — callback (browser navigation, not a fetch call)
  // ---------------------------------------------------------------------------

  @Get('microsoft/callback')
  @ApiOperation({
    summary: 'Microsoft OAuth redirect target',
    description:
      'Public endpoint Microsoft redirects to with `code` + `state`. Exchanges the code, persists the connection, then redirects to the frontend.',
  })
  async microsoftCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Query('error_description') errorDescription: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const failureRedirect = (reason: string) => {
      const url = new URL(this.configService.appUrl + '/settings');
      url.searchParams.set('email_tracking', 'error');
      url.searchParams.set('reason', reason);
      res.redirect(302, url.toString());
    };

    if (error) {
      this.logger.warn(`Microsoft OAuth callback returned error=${error} desc=${errorDescription}`);
      return failureRedirect(error);
    }
    if (!code || !state) {
      return failureRedirect('missing_code_or_state');
    }

    let parsed: OAuthState;
    try {
      parsed = this.verifyState(state);
    } catch (err) {
      this.logger.warn(`OAuth state verification failed: ${(err as Error).message}`);
      return failureRedirect('invalid_state');
    }

    try {
      const grant = await this.graph.exchangeCodeForTokens(code);
      await this.connections.createMicrosoftConnection({
        userId: parsed.uid,
        grant,
      });
    } catch (err) {
      this.logger.error(`Microsoft OAuth exchange failed: ${(err as Error).message}`);
      return failureRedirect('exchange_failed');
    }

    res.redirect(302, this.configService.msGraphPostConnectRedirect);
  }

  // ---------------------------------------------------------------------------
  // Disconnect
  // ---------------------------------------------------------------------------

  @Delete('connections/:id')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @RequiresFeature('emailParsing')
  @ApiOperation({ summary: 'Disconnect a mailbox and revoke its Graph subscription' })
  @ApiResponse({ status: 204, description: 'Mailbox disconnected' })
  async disconnect(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    await this.connections.disconnect(user.id, id);
    res.status(204).send();
  }

  // ---------------------------------------------------------------------------
  // OAuth state signing (lightweight HMAC, not a full JWT — short-lived)
  // ---------------------------------------------------------------------------

  /**
   * State is `<base64(JSON)>.<hmac>`. We reuse the JWT secret as the
   * signing key — no new env var, and the secret already meets the
   * length/entropy requirements.
   */
  private signState(payload: OAuthState): string {
    const json = JSON.stringify({ ...payload, t: Date.now() });
    const b64 = Buffer.from(json, 'utf8').toString('base64url');
    const sig = crypto
      .createHmac('sha256', this.configService.jwtSecret)
      .update(b64)
      .digest('base64url');
    return `${b64}.${sig}`;
  }

  private verifyState(state: string): OAuthState {
    const [b64, sig] = state.split('.');
    if (!b64 || !sig) throw new BadRequestException('Malformed state');
    const expected = crypto
      .createHmac('sha256', this.configService.jwtSecret)
      .update(b64)
      .digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      throw new BadRequestException('State signature mismatch');
    }
    const payload = JSON.parse(Buffer.from(b64, 'base64url').toString('utf8')) as OAuthState & {
      t: number;
    };
    // 10-minute window — more than enough for a normal consent flow.
    if (Date.now() - payload.t > 10 * 60 * 1000) {
      throw new BadRequestException('State expired');
    }
    if (!payload.uid) throw new BadRequestException('Missing uid');
    return { uid: payload.uid, n: payload.n };
  }
}
