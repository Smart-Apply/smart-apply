/**
 * Sentry initialization for the NestJS API.
 *
 * Imported at the very top of main.ts (before AppModule loads) so that
 * stack traces for module instantiation errors get captured too.
 *
 * If SENTRY_DSN is missing, Sentry stays uninitialized — no crash, no warning
 * spam. Errors will still be logged via Pino as today.
 *
 * PII handling: we explicitly disable Sentry's automatic IP/cookie capture
 * and scrub email/firstName/lastName fields from event payloads before they
 * leave the process. Stack traces and error messages still go up.
 */
import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

const SENSITIVE_KEYS = new Set([
  'password',
  'newPassword',
  'currentPassword',
  'token',
  'access_token',
  'refresh_token',
  'authorization',
  'cookie',
  'jwt',
  'secret',
  'apiKey',
  'api_key',
  'csrfToken',
  'twoFactorSecret',
  'backupCodes',
]);

const PII_KEYS = new Set(['email', 'firstName', 'lastName', 'phone', 'address']);

function scrub(obj: unknown, depth = 0): unknown {
  if (depth > 6 || obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map((v) => scrub(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(k)) {
      out[k] = '[REDACTED]';
    } else if (PII_KEYS.has(k)) {
      out[k] = '[PII]';
    } else {
      out[k] = scrub(v, depth + 1);
    }
  }
  return out;
}

export function initSentry(): boolean {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    return false;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    release: process.env.SENTRY_RELEASE, // optional, set from CI commit SHA
    // Capture 100% of errors. Sample down only if Sentry quota becomes a problem.
    sampleRate: 1.0,
    // Performance tracing — 10% of requests is plenty to spot slow endpoints
    tracesSampleRate: 0.1,
    // CPU profiling on the 10% of traced requests
    profilesSampleRate: 1.0,
    integrations: [nodeProfilingIntegration()],
    // Don't auto-attach IP / user identifiers — we'll add minimal context manually
    sendDefaultPii: false,
    beforeSend(event) {
      // Scrub request body, query, headers
      if (event.request) {
        if (event.request.data) {
          event.request.data = scrub(event.request.data);
        }
        if (event.request.query_string && typeof event.request.query_string === 'object') {
          // Sentry's QueryParams type is essentially Record<string,string> | string |
          // [string,string][] — only the object form needs scrubbing for our use.
          event.request.query_string = scrub(event.request.query_string) as typeof event.request.query_string;
        }
        if (event.request.headers) {
          const headers = event.request.headers as Record<string, string>;
          delete headers.authorization;
          delete headers.cookie;
          delete headers['x-csrf-token'];
        }
      }
      // Don't include user emails in the event payload
      if (event.user) {
        event.user = { id: event.user.id }; // keep only ID for grouping
      }
      return event;
    },
  });

  return true;
}

/** Re-export to keep call sites short */
export { Sentry };
