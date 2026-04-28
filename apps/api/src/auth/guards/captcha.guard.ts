import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { CloudflareTurnstileService } from '../services/cloudflare-turnstile.service';
import { REQUIRES_CAPTCHA_KEY } from '../decorators/requires-captcha.decorator';

/**
 * CaptchaGuard
 *
 * Verifies a Cloudflare Turnstile token on routes annotated with
 * `@RequiresCaptcha()`. Registered as an `APP_GUARD` *before* the
 * throttler so that failed CAPTCHAs never consume the route's
 * rate-limit budget.
 *
 * Why this matters: the throttler guard increments storage on every
 * request that reaches it. If CAPTCHA verification lived inside the
 * controller (after the throttler), a Firefox user whose Turnstile
 * widget can't issue a token (common with strict tracking protection)
 * would burn through `RATE_LIMIT_AUTH_MAX` attempts in seconds and get
 * locked out for 15 minutes without ever making a real registration
 * attempt.
 *
 * Token source: `request.body.turnstileToken` (raw — body validation
 * pipes have not yet run at the guard stage). The token is forwarded
 * to Cloudflare's siteverify; failure throws a 403 with the same
 * `CAPTCHA_FAILED` code shape the frontend already handles.
 */
@Injectable()
export class CaptchaGuard implements CanActivate {
  private readonly logger = new Logger(CaptchaGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly turnstileService: CloudflareTurnstileService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requires = this.reflector.getAllAndOverride<boolean>(REQUIRES_CAPTCHA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requires) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const body = (request.body ?? {}) as { turnstileToken?: unknown };
    const token = typeof body.turnstileToken === 'string' ? body.turnstileToken : undefined;
    const remoteIp = request.ip || request.socket?.remoteAddress;

    const ok = await this.turnstileService.verify(token, remoteIp);
    if (!ok) {
      // Same payload shape the controller used to return so the
      // frontend's existing CAPTCHA_FAILED handling keeps working.
      throw new ForbiddenException({
        message:
          'Bot-Schutz fehlgeschlagen. Bitte aktualisiere die Seite und versuche es erneut.',
        error: 'CAPTCHA_FAILED',
        code: 'CAPTCHA_FAILED',
      });
    }

    return true;
  }
}
