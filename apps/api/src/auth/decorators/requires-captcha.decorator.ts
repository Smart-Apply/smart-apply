import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key used by `CaptchaGuard` to identify routes that require a
 * verified Cloudflare Turnstile token in the request body.
 */
export const REQUIRES_CAPTCHA_KEY = 'requiresCaptcha';

/**
 * Mark an endpoint as requiring a valid Cloudflare Turnstile token.
 *
 * The token must be present in the request body as `turnstileToken`.
 * Verification runs in `CaptchaGuard` *before* the throttler guard, so
 * failed CAPTCHAs return 403 without consuming the route's rate-limit
 * budget. This prevents legitimate users (especially on Firefox/Safari
 * with strict tracking protection) from getting locked out for 15 min
 * just because the Turnstile widget couldn't issue a token.
 *
 * If `TURNSTILE_SECRET_KEY` is unset (dev/local), the guard no-ops —
 * matching `CloudflareTurnstileService.verify` behavior.
 */
export const RequiresCaptcha = () => SetMetadata(REQUIRES_CAPTCHA_KEY, true);
